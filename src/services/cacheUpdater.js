/**
 * Cache updater service - 24-hour background update cycle
 * @module services/cacheUpdater
 */

const database = require( './database' );

const { fetchAndEnrichArtistData } = require( './artistService' );

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
 * Updates a single act by fetching fresh data and replacing cache
 * Skips update on error without throwing
 * @param {string} actId - The MusicBrainz artist ID to update
 * @returns {Promise<void>} Resolves when update completes or fails
 */
const updateAct = async ( actId ) => {
  try {
    // Fetch and enrich artist data (with silent event failures)
    const dataToCache = await fetchAndEnrichArtistData( actId, true );

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
 * @returns {Promise<void>} Never resolves (runs forever)
 */
const start = async ( options ) => {
  // Apply defaults explicitly to improve testability
  const cycleIntervalMs = options?.cycleIntervalMs ?? TWENTY_FOUR_HOURS_MS;
  const retryDelayMs = options?.retryDelayMs ?? ONE_MINUTE_MS;

  // Run cycles perpetually
  // eslint-disable-next-line no-constant-condition
  while ( true ) {
    await runCycle( cycleIntervalMs, retryDelayMs );
  }
};

module.exports = {
  start,
  updateAct
};
