/**
 * Fetch queue processor - sequential background fetching with delays
 * This module breaks circular dependencies by being imported by others
 * @module services/fetchQueue
 */

const THIRTY_SECONDS_MS = 30 * 1000;

// Module-level queue and flag to prevent concurrent fetches and duplicates
const fetchQueue = new Set();
let isBackgroundFetchRunning = false;

/**
 * Promise-based sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Resolves after delay
 */
const sleep = ( ms ) => new Promise( ( resolve ) => {
  setTimeout( resolve, ms );
} );

/**
 * Processes the fetch queue sequentially with 30-second delays
 * Uses lazy require pattern to avoid circular dependency with artistService
 * @param {Set<string>} queue - Set of MusicBrainz artist IDs to fetch
 * @returns {Promise<void>} Resolves when queue is empty
 */
const processFetchQueue = async ( queue ) => {
  /*
   * CRITICAL: Lazy require to break circular dependency
   * This function is called after all modules are loaded, so it's safe
   */
  const artistService = require( './artistService' );

  // Process queue until empty
  while ( queue.size > 0 ) {
    // Get first item from Set
    const [ actId ] = queue;

    // Remove from queue before processing
    queue.delete( actId );

    try {
      // Fetch and enrich artist data with silent event failures
      const dataToCache = await artistService.fetchAndEnrichArtistData( actId, true );

      // Cache the result
      await mf.database.cacheArtist( dataToCache );
    } catch ( error ) {
      // Silent fail
    }

    // Wait 30 seconds before processing next act (only if queue not empty)
    if ( queue.size > 0 ) {
      await sleep( THIRTY_SECONDS_MS );
    }
  }
};

/**
 * Triggers background sequential fetch for missing artist IDs
 * Adds IDs to queue and starts processor if not already running
 * Prevents reload hammering by using a Set (duplicates ignored)
 * @param {Array<string>} artistIds - Array of MusicBrainz artist IDs to fetch
 * @returns {void} Returns immediately after queueing
 */
const triggerBackgroundFetch = ( artistIds ) => {
  // Add all missing IDs to the queue (Set prevents duplicates)
  for ( const artistId of artistIds ) {
    fetchQueue.add( artistId );
  }

  // If processor already running, just return (IDs are queued)
  if ( isBackgroundFetchRunning ) {
    return;
  }

  // Start the queue processor
  isBackgroundFetchRunning = true;

  // Process queue in background (fire-and-forget)
  processFetchQueue( fetchQueue ).
    then( () => {
      isBackgroundFetchRunning = false;
    } ).
    catch( ( error ) => {
      // This is defensive programming! It should be impossible to land here as of now
      isBackgroundFetchRunning = false;
      console.error( 'Background fetch error:', error.message );
    } );
};

module.exports = {
  processFetchQueue,
  triggerBackgroundFetch
};
