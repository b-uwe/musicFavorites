/**
 * Cache updater service - 24-hour background update cycle
 * @module services/cacheUpdater
 */

const bandsintownTransformer = require( './bandsintownTransformer' );
const database = require( './database' );
const ldJsonExtractor = require( './ldJsonExtractor' );
const musicbrainzClient = require( './musicbrainz' );
const musicbrainzTransformer = require( './musicbrainzTransformer' );

const { determineStatus, getBerlinTimestamp } = require( './artistService' );

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

/**
 * Promise-based sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Resolves after delay
 */
const sleep = ( ms ) => new Promise( ( resolve ) => {
  /* global setTimeout */
  setTimeout( resolve, ms );
} );

/**
 * Fetches Bandsintown events for an artist
 * @param {object} artistData - Transformed artist data with relations
 * @returns {Promise<Array>} Array of transformed events or empty array
 */
const fetchEvents = async ( artistData ) => {
  if ( !artistData.relations || !artistData.relations.bandsintown ) {
    return [];
  }

  const bandsintownUrl = artistData.relations.bandsintown;

  try {
    const ldJsonData = await ldJsonExtractor.fetchAndExtractLdJson( bandsintownUrl );

    return bandsintownTransformer.transformEvents( ldJsonData );
  } catch ( error ) {
    return [];
  }
};

/**
 * Updates a single act by fetching fresh data and replacing cache
 * Skips update on error without throwing
 * @param {string} actId - The MusicBrainz artist ID to update
 * @returns {Promise<void>} Resolves when update completes or fails
 */
const updateAct = async ( actId ) => {
  try {
    // Fetch fresh data from MusicBrainz
    const mbData = await musicbrainzClient.fetchArtist( actId );
    const transformedData = musicbrainzTransformer.transformArtistData( mbData );

    // Fetch events if available
    const events = await fetchEvents( transformedData );

    // Determine status based on events
    const finalStatus = determineStatus( events, transformedData.status );

    // Prepare data with timestamp
    const dataToCache = {
      ...transformedData,
      'status': finalStatus,
      'updatedAt': getBerlinTimestamp(),
      events
    };

    // Replace cache entry
    await database.cacheArtist( dataToCache );
  } catch ( error ) {
    console.error( `✗ Failed to update act ${actId}:`, error.message );
  }
};

/**
 * Executes one complete update cycle for all cached acts
 * @param {number} cycleIntervalMs - Cycle duration in milliseconds
 * @param {number} retryDelayMs - Retry delay on error in milliseconds
 * @returns {Promise<void>} Resolves when cycle completes
 */
const runCycle = async ( cycleIntervalMs, retryDelayMs ) => {
  try {
    // Fetch all act IDs from cache
    const actIds = await database.getAllActIds();

    if ( actIds.length === 0 ) {
      await sleep( cycleIntervalMs );

      return;
    }

    // Calculate time slice: cycle interval divided by number of acts
    const timeSlice = cycleIntervalMs / actIds.length;

    // Update each act in sequence
    for ( const actId of actIds ) {
      await updateAct( actId );
      await sleep( timeSlice );
    }
  } catch ( error ) {
    console.error( '❌ Cycle error:', error.message );
    await sleep( retryDelayMs );
  }
};

/**
 * Starts the update cycle
 * Runs perpetually in background, updating all cached acts
 * @param {object} options - Configuration options
 * @param {number} options.cycleIntervalMs - Total cycle duration in ms (default: 24 hours)
 * @param {number} options.retryDelayMs - Retry delay on error in ms (default: 1 minute)
 * @param {number} options.maxCycles - Maximum cycles to run (default: Infinity for production)
 * @returns {Promise<void>} Resolves when maxCycles reached or never (if Infinity)
 */
const start = async ( options ) => {
  // Apply defaults explicitly to improve testability
  const cycleIntervalMs = options?.cycleIntervalMs ?? TWENTY_FOUR_HOURS_MS;
  const retryDelayMs = options?.retryDelayMs ?? ONE_MINUTE_MS;
  const maxCycles = options?.maxCycles ?? Infinity;

  // Run cycles perpetually (or until maxCycles reached)
  let cyclesRun = 0;

  // eslint-disable-next-line no-constant-condition
  while ( true ) {
    await runCycle( cycleIntervalMs, retryDelayMs );
    cyclesRun++;

    if ( cyclesRun >= maxCycles ) {
      break;
    }
  }
};

module.exports = {
  start,
  updateAct
};
