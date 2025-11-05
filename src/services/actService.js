( () => {
  'use strict';

  /**
   * Act service with transparent caching
   * @module services/actService
   */

  require( './bandsintownTransformer' );
  require( './cacheUpdater' );
  require( './database' );
  require( './fetchQueue' );
  require( './ldJsonExtractor' );
  require( './musicbrainz' );
  require( './musicbrainzTransformer' );

  let cacheHealthy = true;
  const DB_TIMEOUT_MS = 500;

  /**
   * Wraps a promise with a timeout to prevent hanging
   * @param {Promise} promise - The promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise that rejects if timeout is reached
   */
  const withTimeout = ( promise, timeoutMs ) => Promise.race( [
    promise,
    new Promise( ( _, reject ) => {
      setTimeout( () => reject( new Error( 'Database operation timeout' ) ), timeoutMs );
    } )
  ] );

  /**
   * Ensures cache is healthy before proceeding with operations
   * Tests cache health if previously flagged as unhealthy
   * Attempts reconnection if health check fails
   * Includes 500ms timeout to prevent hanging on database issues
   * @returns {Promise<void>} Resolves if cache is healthy
   * @throws {Error} When cache is unavailable or timeout (SVC_001)
   */
  const ensureCacheHealthy = async () => {
    if ( !cacheHealthy ) {
      mf.logger.warn( 'Cache marked unhealthy, attempting recovery' );
      try {
        // Try to reconnect if needed (client may have been reset)
        await withTimeout( mf.database.connect(), DB_TIMEOUT_MS );
        // Test cache health
        await withTimeout( mf.database.testCacheHealth(), DB_TIMEOUT_MS );
        cacheHealthy = true;
        mf.logger.info( 'Cache health recovered successfully' );
      } catch ( error ) {
        mf.logger.error( { 'err': error }, 'Cache recovery failed' );
        throw new Error( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );
      }
    }
  };

  /**
   * Formats current timestamp in Berlin timezone with offset
   * Using sv-SE locale gives format: YYYY-MM-DD HH:MM:SS+01:00 or +02:00
   * @returns {string} Timestamp with timezone offset (CET/CEST handled automatically)
   */
  const getBerlinTimestamp = () => {
    const date = new Date();
    const dateStr = date.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );
    const formatter = new Intl.DateTimeFormat( 'sv-SE', {
      'timeZone': 'Europe/Berlin',
      'timeZoneName': 'longOffset'
    } );
    const parts = formatter.formatToParts( date );
    const offsetPart = parts.find( ( part ) => part.type === 'timeZoneName' );
    const offset = offsetPart ? offsetPart.value.replace( 'GMT', '' ) : '+01:00';

    return `${dateStr}${offset}`;
  };

  /**
   * Determines act status based on upcoming events
   * @param {Array} events - Array of event objects with date field
   * @param {string} musicbrainzStatus - Original status from MusicBrainz
   * @returns {string} Determined status: "on tour", "tour planned", or original MusicBrainz status
   */
  const determineStatus = ( events, musicbrainzStatus ) => {
    if ( !events || events.length === 0 ) {
      return musicbrainzStatus;
    }

    const now = new Date();

    now.setUTCHours( 0, 0, 0, 0 );

    const threeMonthsFromNow = new Date( now );

    threeMonthsFromNow.setUTCDate( threeMonthsFromNow.getUTCDate() + 90 );

    const nineMonthsFromNow = new Date( now );

    nineMonthsFromNow.setUTCDate( nineMonthsFromNow.getUTCDate() + 270 );

    // Find the nearest valid event
    let nearestEventDate = null;

    for ( const event of events ) {
      if ( event.date && typeof event.date === 'string' ) {
        const eventDate = new Date( `${event.date}T00:00:00Z` );

        if ( !isNaN( eventDate.getTime() ) ) {
          if ( !nearestEventDate || eventDate < nearestEventDate ) {
            nearestEventDate = eventDate;
          }
        }
      }
    }

    if ( !nearestEventDate ) {
      return musicbrainzStatus;
    }

    if ( nearestEventDate <= threeMonthsFromNow ) {
      return 'on tour';
    }

    if ( nearestEventDate <= nineMonthsFromNow ) {
      return 'tour planned';
    }

    return musicbrainzStatus;
  };

  /**
   * Fetches Bandsintown events for an act
   * @param {object} actData - Transformed act data with relations
   * @param {boolean} silentFail - If true, returns empty array on error instead of throwing
   * @returns {Promise<Array>} Array of transformed events or empty array
   */
  const fetchBandsintownEvents = async ( actData, silentFail = false ) => {
    if ( !actData.relations?.bandsintown ) {
      return [];
    }

    const bandsintownUrl = actData.relations.bandsintown;

    // Validate Bandsintown URL format
    if ( bandsintownUrl.match( /^https?:\/\/(?:www\.)?bandsintown\.com\/a\/(?:\d+)$/u )?.length !== 1 ) {
      mf.logger.error( {
        'actId': actData.musicbrainzId || actData._id,
        'invalidUrl': bandsintownUrl,
        'issue': 'invalid_bandsintown_url'
      }, 'Invalid Bandsintown URL format - possible attack or data corruption' );
      return [];
    }

    try {
      const ldJsonData = await mf.ldJsonExtractor.fetchAndExtractLdJson( bandsintownUrl );
      const result = mf.bandsintownTransformer.transformEvents( ldJsonData, true );

      // Log broken event data with rejection reasons
      if ( result.rejected && result.rejected.length > 0 ) {
        mf.logger.warn( {
          'actId': actData.musicbrainzId || actData._id,
          'rejectedCount': result.rejected.length,
          'rejectedEvents': result.rejected,
          'issue': 'broken_event_data'
        }, 'Bandsintown events rejected during transformation' );
      }

      return result.events;
    } catch ( error ) {
      if ( silentFail ) {
        return [];
      }
      throw error;
    }
  };

  /**
   * Fetches and enriches act data from MusicBrainz with events and computed status
   * @param {string} actId - The MusicBrainz act ID
   * @param {boolean} silentEventFail - If true, event fetch errors return empty array instead of throwing
   * @returns {Promise<object>} Complete act data with events, status, and timestamp
   */
  const fetchAndEnrichActData = async ( actId, silentEventFail = false ) => {
    // Fetch fresh data from MusicBrainz
    const mbData = await mf.musicbrainz.fetchAct( actId );
    const transformedData = mf.musicbrainzTransformer.transformActData( mbData );

    // Fetch Bandsintown events if available
    const events = await fetchBandsintownEvents( transformedData, silentEventFail );

    // Determine status based on events
    const finalStatus = determineStatus( events, transformedData.status );

    const hasBandsintown = Boolean( transformedData.relations?.bandsintown );
    const hasSongkick = Boolean( transformedData.relations?.songkick );

    mf.logger.info( {
      actId,
      hasBandsintown,
      hasSongkick,
      'eventCount': events.length,
      finalStatus
    }, 'Act enrichment completed' );

    return {
      ...transformedData,
      'status': finalStatus,
      'updatedAt': getBerlinTimestamp(),
      events
    };
  };

  /**
   * Categorizes acts as cached or missing
   * @param {Array<string>} actIds - Array of act IDs
   * @param {Array<object|null>} cacheResults - Corresponding cache results
   * @returns {object} Object with cachedActs and missingIds arrays
   */
  const categorizeActs = ( actIds, cacheResults ) => {
    const cachedActs = [];
    const missingIds = [];

    for ( let i = 0; i < actIds.length; i += 1 ) {
      if ( cacheResults[ i ] ) {
        cachedActs.push( cacheResults[ i ] );
      } else {
        missingIds.push( actIds[ i ] );
      }
    }

    return {
      cachedActs,
      missingIds
    };
  };

  /**
   * Checks cached acts for staleness and triggers background refresh
   * @param {Array<object>} cachedActs - Array of cached act objects
   * @returns {void}
   */
  const checkAndRefreshStaleActs = ( cachedActs ) => {
    if ( cachedActs.length === 0 ) {
      return;
    }

    const staleActIds = cachedActs.
      filter( ( act ) => mf.cacheUpdater.isActStale( act ) ).
      map( ( act ) => act.musicbrainzId );

    if ( staleActIds.length > 0 ) {
      mf.logger.debug( {
        'staleCount': staleActIds.length,
        'cachedCount': cachedActs.length
      }, 'Triggering background refresh for stale acts' );
      mf.fetchQueue.triggerBackgroundFetch( staleActIds );
    }
  };

  /**
   * Fetches cached data for multiple acts with timeout protection
   * @param {Array<string>} actIds - Array of act IDs to fetch
   * @returns {Promise<Array>} Array of cached results (null if not cached)
   * @throws {Error} When cache is unavailable or timeout (SVC_002)
   */
  const fetchCachedActs = async ( actIds ) => {
    try {
      return await Promise.all( actIds.map( ( id ) => withTimeout(
        mf.database.getActFromCache( id ),
        DB_TIMEOUT_MS
      ) ) );
    } catch ( error ) {
      cacheHealthy = false;
      mf.logger.error( { 'err': error }, 'Failed to fetch acts from cache' );
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: SVC_002)' );
    }
  };

  /**
   * Handles case where exactly 1 act is missing
   * @param {string} missingId - The missing act ID
   * @param {Array<object>} cachedActs - Already cached acts
   * @returns {Promise<object>} Result with all acts
   */
  const handleSingleMissingAct = async ( missingId, cachedActs ) => {
    const freshData = await fetchAndEnrichActData( missingId );

    // Cache asynchronously (fire-and-forget)
    mf.database.cacheAct( freshData ).catch( () => {
      cacheHealthy = false;
    } );

    // Map _id to musicbrainzId for the freshly fetched act
    const { _id, ...freshActData } = freshData;
    const formattedFreshAct = {
      'musicbrainzId': _id,
      ...freshActData
    };

    return {
      'acts': [ ...cachedActs, formattedFreshAct ]
    };
  };

  /**
   * Handles case where 2+ acts are missing
   * @param {Array<string>} missingIds - Array of missing act IDs
   * @param {number} cachedCount - Number of cached acts
   * @returns {object} Error response with background fetch notification
   */
  const handleMultipleMissingActs = ( missingIds, cachedCount ) => {
    // Trigger background sequential fetch (adds to queue, prevents duplicates)
    mf.fetchQueue.triggerBackgroundFetch( missingIds );

    return {
      'error': {
        'message': `${missingIds.length} acts not cached. ` +
          'Background fetch initiated. Please try again in a few minutes.',
        'missingCount': missingIds.length,
        cachedCount
      }
    };
  };

  /**
   * Fetches multiple acts with smart caching strategy
   * Protects upstream services by failing fast when cache is unhealthy
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs
   * @returns {Promise<object>} Result object with acts array or error
   * @throws {Error} When cache is unhealthy or unavailable
   */
  const fetchMultipleActs = async ( actIds ) => {
    if ( !Array.isArray( actIds ) || actIds.length === 0 ) {
      return {
        'error': {
          'message': 'Invalid input: actIds must be a non-empty array'
        }
      };
    }

    await ensureCacheHealthy();

    const cacheResults = await fetchCachedActs( actIds );
    const { cachedActs, missingIds } = categorizeActs( actIds, cacheResults );

    checkAndRefreshStaleActs( cachedActs );

    if ( missingIds.length === 0 ) {
      return {
        'acts': cachedActs
      };
    }

    if ( missingIds.length === 1 ) {
      mf.logger.info( {
        'actCount': actIds.length,
        'cachedCount': cachedActs.length
      }, 'Fetching 1 missing act synchronously' );
      return handleSingleMissingAct( missingIds[ 0 ], cachedActs );
    }

    mf.logger.info( {
      'actCount': actIds.length,
      'cachedCount': cachedActs.length,
      'missingCount': missingIds.length
    }, 'Multiple acts missing, using background fetch' );
    return handleMultipleMissingActs( missingIds, cachedActs.length );
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.actService = {
    determineStatus,
    fetchAndEnrichActData,
    fetchBandsintownEvents,
    fetchMultipleActs,
    getBerlinTimestamp
  };

  // Expose private functions for unit testing when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.actService = {
      withTimeout
    };
  }
} )();
