/**
 * Artist service with transparent caching
 * @module services/artistService
 */

const bandsintownTransformer = require( './bandsintownTransformer' );
const database = require( './database' );
const ldJsonExtractor = require( './ldJsonExtractor' );
const musicbrainzClient = require( './musicbrainz' );
const musicbrainzTransformer = require( './musicbrainzTransformer' );

let cacheHealthy = true;

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
 * Gets artist data with transparent caching
 * Checks cache first, falls back to MusicBrainz API if not found
 * Caches API results asynchronously (fire-and-forget)
 * Protects upstream services by failing fast when cache is unhealthy
 * @param {string} artistId - The MusicBrainz artist ID
 * @returns {Promise<object>} Artist data (from cache or API)
 * @throws {Error} When cache is unhealthy or unavailable
 */
const getArtist = async ( artistId ) => {
  // If cache was flagged unhealthy, test it before proceeding
  if ( !cacheHealthy ) {
    try {
      await database.testCacheHealth();
      cacheHealthy = true;
    } catch ( error ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );
    }
  }

  // Try to get from cache first
  const cachedArtist = await database.getArtistFromCache( artistId );

  if ( cachedArtist ) {
    return cachedArtist;
  }

  // Cache miss - fetch and enrich artist data
  const dataWithEvents = await fetchAndEnrichArtistData( artistId );

  // Cache asynchronously (fire-and-forget) - don't wait for it
  database.cacheArtist( dataWithEvents ).catch( () => {
    cacheHealthy = false;
  } );

  // Map _id to musicbrainzId for API response
  const { _id, ...artistData } = dataWithEvents;

  return {
    'musicbrainzId': _id,
    ...artistData
  };
};

/**
 * Triggers background sequential fetch for missing artist IDs
 * Uses 30-second delays between fetches to protect upstream APIs
 * @param {Array<string>} artistIds - Array of MusicBrainz artist IDs to fetch
 * @returns {Promise<void>} Resolves when all fetches complete
 */
const triggerBackgroundSequentialFetch = async ( artistIds ) => {
  const cacheUpdater = require( './cacheUpdater' );
  const THIRTY_SECONDS_MS = 30 * 1000;

  /**
   * Promise-based sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Resolves after delay
   */
  const sleep = ( ms ) => new Promise( ( resolve ) => {
    /* global setTimeout */
    setTimeout( resolve, ms );
  } );

  // Process each artist ID with 30-second delays
  for ( const artistId of artistIds ) {
    await cacheUpdater.updateAct( artistId );
    await sleep( THIRTY_SECONDS_MS );
  }
};

/**
 * Gets multiple artists from cache only (no API fallback)
 * Triggers background sequential fetch for missing IDs
 * @param {Array<string>} artistIds - Array of MusicBrainz artist IDs
 * @returns {Promise<Array<object>>} Array of cached artist data
 * @throws {Error} When any artist ID is not found in cache
 */
const getMultipleArtistsFromCache = async ( artistIds ) => {
  const results = [];
  const missingIds = [];

  // Try to get all artists from cache
  for ( const artistId of artistIds ) {
    const cachedArtist = await database.getArtistFromCache( artistId );

    if ( cachedArtist ) {
      results.push( cachedArtist );
    } else {
      missingIds.push( artistId );
    }
  }

  // If any IDs are missing, trigger background fetch and throw error
  if ( missingIds.length > 0 ) {
    // Trigger background fetch (fire-and-forget)
    triggerBackgroundSequentialFetch( missingIds ).catch( () => {
      // Silent failure - background fetch errors are logged but don't affect response
    } );

    throw new Error( `Missing from cache: ${missingIds.join( ', ' )}` );
  }

  return results;
};

module.exports = {
  determineStatus,
  getArtist,
  getBerlinTimestamp,
  fetchBandsintownEvents,
  fetchAndEnrichArtistData,
  getMultipleArtistsFromCache,
  triggerBackgroundSequentialFetch
};
