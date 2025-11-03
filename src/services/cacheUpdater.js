( () => {
  'use strict';

  /**
   * Cache updater service - dual update strategy
   * Sequential bootstrap on startup, then 24-hour cycle-based updates
   * @module services/cacheUpdater
   */

  require( './database' );

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const THIRTY_SECONDS_MS = 30 * 1000;
  const ONE_MINUTE_MS = 60 * 1000;

  /**
   * Promise-based sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Resolves after delay
   */
  const sleep = ( ms ) => new Promise( ( resolve ) => {
    setTimeout( resolve, ms );
  } );

  /**
   * Determines error source from error message patterns
   * @param {Error} error - The error object
   * @returns {string} Error source: 'musicbrainz', 'bandsintown', or 'cache'
   */
  const determineErrorSource = ( error ) => {
    const message = error.message.toLowerCase();

    if ( message.includes( 'musicbrainz' ) || message.includes( 'mb_' ) ) {
      return 'musicbrainz';
    }

    if ( message.includes( 'bandsintown' ) ) {
      return 'bandsintown';
    }

    if ( message.includes( 'db_' ) || message.includes( 'database' ) || message.includes( 'cache' ) ) {
      return 'cache';
    }

    return 'unknown';
  };

  /**
   * Updates a single act by fetching fresh data and replacing cache
   * Skips update on error without throwing
   * Uses lazy require to avoid circular dependency with actService
   * @param {string} actId - The MusicBrainz act ID to update
   * @returns {Promise<void>} Resolves when update completes or fails
   */
  const updateAct = async ( actId ) => {
    /*
     * CRITICAL: Lazy require to break circular dependency
     * This function is called after all modules are loaded, so it's safe
     */
    require( './actService' );

    try {
      // Fetch and enrich act data (with silent event failures)
      const dataToCache = await mf.actService.fetchAndEnrichActData( actId, true );

      // Replace cache entry
      await mf.database.cacheAct( dataToCache );
    } catch ( error ) {
      mf.logger.error( {
        actId,
        'err': error
      }, 'Failed to update act' );

      // Log error to database
      try {
        await mf.databaseAdmin.logUpdateError( {
          'timestamp': mf.actService.getBerlinTimestamp(),
          actId,
          'errorMessage': error.message,
          'errorSource': determineErrorSource( error )
        } );
      } catch ( logError ) {
        // Silent fail on logging error to prevent cascading failures
        mf.logger.error( {
          actId,
          'err': logError
        }, 'Failed to log update error' );
      }
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
      const actIds = await mf.database.getAllActIds();

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
      mf.logger.error( {
        'err': error
      }, 'Cache update cycle error' );
      await sleep( retryDelayMs );
    }
  };

  /**
   * Determines if an act is stale (needs updating)
   * @param {object} act - Act object with _id and optional updatedAt
   * @returns {boolean} True if act should be updated
   */
  const isActStale = ( act ) => {
    // No updatedAt field means never updated, so it's stale
    if ( !act.updatedAt ) {
      return true;
    }

    // Parse updatedAt timestamp (format: "YYYY-MM-DD HH:MM:SS")
    const updatedAtDate = new Date( act.updatedAt );
    const now = Date.now();
    const ageMs = now - updatedAtDate.getTime();

    // Stale if older than 24 hours
    return ageMs > TWENTY_FOUR_HOURS_MS;
  };

  /**
   * Runs a single sequential update of all acts with fixed 30s pauses
   * @returns {Promise<number>} Number of acts processed
   */
  const runSequentialUpdate = async () => {
    try {
      // Fetch all acts with metadata from cache
      const acts = await mf.database.getAllActsWithMetadata();

      if ( acts.length === 0 ) {
        return 0;
      }

      // Filter to only stale acts (lastUpdated > 24h ago or missing)
      const staleActs = acts.filter( isActStale );

      if ( staleActs.length === 0 ) {
        return 0;
      }

      // Remove acts not requested for 14 updates before processing updates
      try {
        await mf.databaseAdmin.removeActsNotRequestedFor14Updates();
      } catch {
        // Silent fail - don't block updates if removal fails
      }

      // Update each stale act with fixed 30s pause
      for ( const act of staleActs ) {
        await updateAct( act._id );
        await sleep( THIRTY_SECONDS_MS );
      }

      return staleActs.length;
    } catch ( error ) {
      mf.logger.error( {
        'err': error
      }, 'Sequential update error' );

      return 0;
    }
  };

  /**
   * Starts dual update strategy: sequential bootstrap then cycle-based
   * @param {object} options - Configuration options
   * @param {number} options.cycleIntervalMs - Total cycle duration in ms (default: 24 hours)
   * @param {number} options.retryDelayMs - Retry delay on error in ms (default: 1 minute)
   * @returns {Promise<void>} Never resolves (runs forever)
   */
  const start = async ( options ) => {
    // Apply defaults explicitly to improve testability
    const cycleIntervalMs = options?.cycleIntervalMs ?? TWENTY_FOUR_HOURS_MS;
    const retryDelayMs = options?.retryDelayMs ?? ONE_MINUTE_MS;

    // Phase 1: Run sequential update once
    await runSequentialUpdate();

    // Phase 2: Wait 12 hours
    await sleep( TWELVE_HOURS_MS );

    // Phase 3: Start perpetual cycle-based updates
    const keepRunning = true;

    while ( keepRunning ) {
      await runCycle( cycleIntervalMs, retryDelayMs );
    }
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.cacheUpdater = {
    isActStale,
    runSequentialUpdate,
    start,
    updateAct
  };

  // Expose private functions for unit testing when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.cacheUpdater = {
      runCycle,
      sleep
    };
  }
} )();
