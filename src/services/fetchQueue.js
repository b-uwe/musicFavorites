( () => {
  'use strict';

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
   * Uses lazy require pattern to avoid circular dependency with actService
   * @param {Set<string>} queue - Set of MusicBrainz act IDs to fetch
   * @returns {Promise<void>} Resolves when queue is empty
   */
  const processFetchQueue = async ( queue ) => {
    /*
     * CRITICAL: Lazy require to break circular dependency
     * This function is called after all modules are loaded, so it's safe
     */
    require( './actService' );

    // Process queue until empty
    while ( queue.size > 0 ) {
      // Get first item from Set
      const [ actId ] = queue;

      // Remove from queue before processing
      queue.delete( actId );

      try {
        // Fetch and enrich act data with silent event failures
        const dataToCache = await mf.actService.fetchAndEnrichActData( actId, true );

        // Cache the result
        await mf.database.cacheAct( dataToCache );
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
   * Triggers background sequential fetch for missing act IDs
   * Adds IDs to queue and starts processor if not already running
   * Prevents reload hammering by using a Set (duplicates ignored)
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs to fetch
   * @returns {void} Returns immediately after queueing
   */
  const triggerBackgroundFetch = ( actIds ) => {
    // Add all missing IDs to the queue (Set prevents duplicates)
    for ( const actId of actIds ) {
      fetchQueue.add( actId );
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

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.fetchQueue = {
    triggerBackgroundFetch
  };

  // Expose private functions and state for unit testing when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.fetchQueue = {
      processFetchQueue,
      fetchQueue,
      /**
       * Sets the background fetch running flag for test isolation
       * @param {boolean} value - The value to set
       * @returns {void}
       */
      'setIsRunning': ( value ) => {
        isBackgroundFetchRunning = value;
      }
    };
  }
} )();
