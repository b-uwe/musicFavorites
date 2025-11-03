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
   * Fetches and caches a single act, tracking success/failure
   * @param {string} actId - The MusicBrainz act ID to fetch
   * @param {number} position - Position in queue (for logging)
   * @param {number} total - Total acts in queue (for logging)
   * @returns {Promise<boolean>} True if successful, false if failed
   */
  const processActInQueue = async ( actId, position, total ) => {
    mf.logger.debug( {
      actId,
      position,
      total
    }, 'Fetching act in background' );

    try {
      // Fetch and enrich act data with silent event failures
      const dataToCache = await mf.actService.fetchAndEnrichActData( actId, true );

      // Cache the result
      await mf.database.cacheAct( dataToCache );

      return true;
    } catch ( error ) {
      // Silent fail
      return false;
    }
  };

  /**
   * Logs completion metrics for the queue processing
   * @param {number} totalActs - Total number of acts processed
   * @param {number} successCount - Number of successful fetches
   * @param {number} errorCount - Number of failed fetches
   * @param {number} startTime - Start timestamp in milliseconds
   * @returns {void}
   */
  const logQueueCompletion = ( totalActs, successCount, errorCount, startTime ) => {
    const duration = Date.now() - startTime;

    mf.logger.info( {
      'actsProcessed': totalActs,
      successCount,
      errorCount,
      duration
    }, 'Background fetch queue completed' );
  };

  /**
   * Processes queue items sequentially until empty
   * @param {Set<string>} queue - Set of MusicBrainz act IDs to fetch
   * @param {object} stats - Object to track success/error counts and position
   * @returns {Promise<void>} Resolves when queue is empty
   */
  const processQueueItems = async ( queue, stats ) => {
    while ( queue.size > 0 ) {
      const [ actId ] = queue;

      queue.delete( actId );
      stats.position++;

      const success = await processActInQueue( actId, stats.position, stats.totalActs );

      if ( success ) {
        stats.successCount++;
      } else {
        stats.errorCount++;
      }

      if ( queue.size > 0 ) {
        mf.logger.debug( {
          'delayMs': THIRTY_SECONDS_MS
        }, 'Waiting before next fetch' );
        await sleep( THIRTY_SECONDS_MS );
      }
    }
  };

  /**
   * Processes the fetch queue sequentially with 30-second delays
   * Uses lazy require pattern to avoid circular dependency with actService
   * @param {Set<string>} queue - Set of MusicBrainz act IDs to fetch
   * @param {string|null} parentCorrelationId - Optional parent correlation ID for linking
   * @returns {Promise<void>} Resolves when queue is empty
   */
  const processFetchQueue = async ( queue, parentCorrelationId = null ) => {
    // Generate queue-specific correlation ID
    const queueId = `queue-${Date.now()}`;
    const correlationId = parentCorrelationId ? `${parentCorrelationId}→${queueId}` : queueId;

    // Wrap entire queue processing in async context for correlation tracking
    await mf.asyncLocalStorage.run( { correlationId }, async () => {
      require( './actService' );

      const startTime = Date.now();
      const stats = {
        'totalActs': queue.size,
        'successCount': 0,
        'errorCount': 0,
        'position': 0
      };

      mf.logger.info( {
        'queueDepth': stats.totalActs
      }, 'Starting background fetch queue' );

      await processQueueItems( queue, stats );

      logQueueCompletion( stats.totalActs, stats.successCount, stats.errorCount, startTime );
    } );
  };

  /**
   * Triggers background sequential fetch for missing act IDs
   * Adds IDs to queue and starts processor if not already running
   * Prevents reload hammering by using a Set (duplicates ignored)
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs to fetch
   * @returns {void} Returns immediately after queueing
   */
  const triggerBackgroundFetch = ( actIds ) => {
    // Capture parent correlation ID if available (e.g., from HTTP request)
    const store = mf.asyncLocalStorage?.getStore();
    const parentCorrelationId = store?.correlationId || null;

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

    // Process queue in background (fire-and-forget) with parent correlation
    processFetchQueue( fetchQueue, parentCorrelationId ).
      then( () => {
        isBackgroundFetchRunning = false;
      } ).
      catch( ( error ) => {
        // This is defensive programming! It should be impossible to land here as of now
        isBackgroundFetchRunning = false;
        mf.logger.error( {
          'err': error
        }, 'Background fetch error' );
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
