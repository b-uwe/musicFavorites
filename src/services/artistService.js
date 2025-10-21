/**
 * Artist service with transparent caching
 * @module services/artistService
 */

const bandsintownTransformer = require( './bandsintownTransformer' );
const database = require( './database' );
const ldJsonExtractor = require( './ldJsonExtractor' );
const musicbrainzClient = require( './musicbrainz' );
const musicbrainzTransformer = require( './musicbrainzTransformer' );

/**
 * Formats current timestamp in Berlin timezone
 * Using sv-SE locale gives format: YYYY-MM-DD HH:MM:SS
 * @returns {string} Timestamp (CET/CEST handled automatically)
 */
const getBerlinTimestamp = () => new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

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
 * Fetches Bandsintown events for an artist
 * @param {object} artistData - Transformed artist data with relations
 * @param {boolean} silentFail - If true, returns empty array on error instead of throwing
 * @returns {Promise<Array>} Array of transformed events or empty array
 */
const fetchBandsintownEvents = async ( artistData, silentFail = false ) => {
  if ( !artistData.relations?.bandsintown ) {
    return [];
  }

  const bandsintownUrl = artistData.relations.bandsintown;

  try {
    const ldJsonData = await ldJsonExtractor.fetchAndExtractLdJson( bandsintownUrl );

    return bandsintownTransformer.transformEvents( ldJsonData );
  } catch ( error ) {
    if ( silentFail ) {
      return [];
    }
    throw error;
  }
};

/**
 * Fetches and enriches artist data from MusicBrainz with events and computed status
 * @param {string} artistId - The MusicBrainz artist ID
 * @param {boolean} silentEventFail - If true, event fetch errors return empty array instead of throwing
 * @returns {Promise<object>} Complete artist data with events, status, and timestamp
 */
const fetchAndEnrichArtistData = async ( artistId, silentEventFail = false ) => {
  // Fetch fresh data from MusicBrainz
  const mbData = await musicbrainzClient.fetchArtist( artistId );
  const transformedData = musicbrainzTransformer.transformArtistData( mbData );

  // Fetch Bandsintown events if available
  const events = await fetchBandsintownEvents( transformedData, silentEventFail );

  // Determine status based on events
  const finalStatus = determineStatus( events, transformedData.status );

  return {
    ...transformedData,
    'status': finalStatus,
    'updatedAt': getBerlinTimestamp(),
    events
  };
};


/**
 * Categorizes acts as cached or missing
 * @param {Array<string>} artistIds - Array of artist IDs
 * @param {Array<object|null>} cacheResults - Corresponding cache results
 * @returns {object} Object with cachedActs and missingIds arrays
 */
const categorizeActs = ( artistIds, cacheResults ) => {
  const cachedActs = [];
  const missingIds = [];

  for ( let i = 0; i < artistIds.length; i += 1 ) {
    if ( cacheResults[ i ] ) {
      cachedActs.push( cacheResults[ i ] );
    } else {
      missingIds.push( artistIds[ i ] );
    }
  }

  return {
    cachedActs,
    missingIds
  };
};

/**
 * Handles case where exactly 1 act is missing
 * @param {string} missingId - The missing artist ID
 * @param {Array<object>} cachedActs - Already cached acts
 * @returns {Promise<object>} Result with all acts
 */
const handleSingleMissingAct = async ( missingId, cachedActs ) => {
  const freshData = await fetchAndEnrichArtistData( missingId );

  // Cache asynchronously (fire-and-forget)
  database.cacheArtist( freshData ).catch( () => {
    // Silently ignore cache write failures for background operations
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
 * @param {Array<string>} missingIds - Array of missing artist IDs
 * @param {number} cachedCount - Number of cached acts
 * @returns {object} Error response with background fetch notification
 */
const handleMultipleMissingActs = ( missingIds, cachedCount ) => {
  const fetchQueue = require( './fetchQueue' );

  // Trigger background sequential fetch (adds to queue, prevents duplicates)
  fetchQueue.triggerBackgroundFetch( missingIds );

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
 * @param {Array<string>} artistIds - Array of MusicBrainz artist IDs
 * @returns {Promise<object>} Result object with acts array or error
 */
const fetchMultipleActs = async ( artistIds ) => {
  if ( !Array.isArray( artistIds ) || artistIds.length === 0 ) {
    return {
      'error': {
        'message': 'Invalid input: artistIds must be a non-empty array'
      }
    };
  }

  const cacheResults = await Promise.all( artistIds.map( ( id ) => database.getArtistFromCache( id ) ) );
  const { cachedActs, missingIds } = categorizeActs( artistIds, cacheResults );

  if ( missingIds.length === 0 ) {
    return {
      'acts': cachedActs
    };
  }

  if ( missingIds.length === 1 ) {
    return handleSingleMissingAct( missingIds[ 0 ], cachedActs );
  }

  return handleMultipleMissingActs( missingIds, cachedActs.length );
};

module.exports = {
  determineStatus,
  fetchAndEnrichArtistData,
  fetchBandsintownEvents,
  fetchMultipleActs,
  getBerlinTimestamp
};
