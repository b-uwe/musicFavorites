/**
 * MongoDB database administration and maintenance module
 * @module services/databaseAdmin
 */

( () => {
  'use strict';

  // Require database module for shared client access
  require( './database' );

  // Constants are already loaded by database.js, but we reference them here too

  /**
   * Gets logger instance with appropriate log level
   * @param {string} defaultLevel - Default log level ('debug' or 'info')
   * @returns {object} Logger instance or no-op fallback
   */
  const getLogger = ( defaultLevel = 'debug' ) => {
    const { 'NODE_ENV': nodeEnv } = process.env;
    const logLevel = nodeEnv === 'test' ? 'error' : defaultLevel;

    const noOpLogger = {
      /** No-op debug fallback @returns {void} */
      'debug': () => {
        /* Intentionally empty - no-op fallback */
      },
      /** No-op info fallback @returns {void} */
      'info': () => {
        /* Intentionally empty - no-op fallback */
      },
      /** No-op warn fallback @returns {void} */
      'warn': () => {
        /* Intentionally empty - no-op fallback */
      },
      /** No-op error fallback @returns {void} */
      'error': () => {
        /* Intentionally empty - no-op fallback */
      }
    };

    return {
      'logger': mf.logger || noOpLogger,
      logLevel
    };
  };

  /**
   * Logs slow database operation warning
   * @param {object} logger - Logger instance
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {object} context - Additional context
   * @returns {void}
   */
  const logSlowOperation = ( logger, operation, duration, context ) => {
    if ( duration > mf.constants.SLOW_QUERY_THRESHOLD_MS ) {
      logger.warn( {
        operation,
        duration,
        ...context
      }, 'Slow database operation' );
    }
  };

  /**
   * Logs a data update error to the database
   * @param {object} errorData - Error information
   * @returns {Promise<void>} Resolves when error is logged
   * @throws {Error} When not connected, missing required fields, or write not acknowledged
   */
  const logUpdateError = async ( errorData ) => {
    const { logger, logLevel } = getLogger();

    if ( !errorData.timestamp || !errorData.actId || !errorData.errorMessage || !errorData.errorSource ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_017)' );
    }

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_016)' );
    }

    logger[ logLevel ]( {
      'actId': errorData.actId,
      'errorSource': errorData.errorSource
    }, 'Logging update error' );

    const collection = db.collection( 'dataUpdateErrors' );

    const result = await collection.insertOne( {
      'timestamp': errorData.timestamp,
      'actId': errorData.actId,
      'errorMessage': errorData.errorMessage,
      'errorSource': errorData.errorSource,
      'createdAt': new Date()
    } );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_018)' );
    }
  };

  /**
   * Gets all data update errors from the last 7 days
   * @returns {Promise<Array<object>>} Array of error objects sorted by timestamp descending
   * @throws {Error} When not connected to database
   */
  const getRecentUpdateErrors = async () => {
    const { logger, logLevel } = getLogger();

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_019)' );
    }

    const startTime = Date.now();
    const collection = db.collection( 'dataUpdateErrors' );

    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate( sevenDaysAgo.getDate() - 7 );

    const results = await collection.find(
      {
        'createdAt': { '$gte': sevenDaysAgo }
      },
      {
        'projection': {
          '_id': 0,
          'timestamp': 1,
          'actId': 1,
          'errorMessage': 1,
          'errorSource': 1
        }
      }
    ).sort( {
      'createdAt': -1
    } ).toArray();

    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'count': results.length,
      duration
    }, 'Retrieved recent update errors' );

    logSlowOperation( logger, 'getRecentUpdateErrors', duration, {
      'count': results.length
    } );

    return results;
  };

  /**
   * Ensures TTL index exists on dataUpdateErrors collection
   * @returns {Promise<void>} Resolves when index is created or already exists
   * @throws {Error} When not connected to database
   */
  const ensureErrorCollectionIndexes = async () => {
    const { logger, logLevel } = getLogger();

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_020)' );
    }

    logger[ logLevel ]( 'Ensuring error collection indexes' );

    const collection = db.collection( 'dataUpdateErrors' );

    await collection.createIndex(
      { 'createdAt': 1 },
      { 'expireAfterSeconds': 604800 }
    );
  };

  /**
   * Clears all cached act data from the database
   * @returns {Promise<void>} Resolves when cache is cleared
   * @throws {Error} When not connected to database or delete not acknowledged
   */
  const clearCache = async () => {
    const { logger, logLevel } = getLogger( 'info' );

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_021)' );
    }

    logger[ logLevel ]( 'Clearing all cached acts' );

    const collection = db.collection( 'acts' );

    const result = await collection.deleteMany( {} );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_022)' );
    }

    logger[ logLevel ]( { 'deletedCount': result.deletedCount }, 'Cache cleared' );
  };

  /**
   * Updates metadata for a single act ID
   * @param {object} collection - MongoDB collection
   * @param {string} actId - Act ID to update
   * @param {string} timestamp - Berlin timestamp
   * @returns {Promise<void>} Resolves when updated
   * @throws {Error} When update not acknowledged
   */
  const updateActMetadata = async ( collection, actId, timestamp ) => {
    const result = await collection.updateOne(
      { '_id': actId },
      {
        '$set': {
          'lastRequestedAt': timestamp,
          'updatesSinceLastRequest': 0
        }
      },
      { 'upsert': true }
    );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_025)' );
    }
  };

  /**
   * Updates lastRequestedAt and resets updatesSinceLastRequest for requested acts
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs
   * @returns {Promise<void>} Resolves when all acts are updated
   * @throws {Error} When not connected, actIds invalid, or update not acknowledged
   */
  const updateLastRequestedAt = async ( actIds ) => {
    const { logger, logLevel } = getLogger();

    if ( !Array.isArray( actIds ) || actIds.length === 0 ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_024)' );
    }

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_023)' );
    }

    const startTime = Date.now();

    logger[ logLevel ]( {
      'count': actIds.length
    }, 'Updating lastRequestedAt for acts' );

    require( './actService' );
    const metadataCollection = db.collection( 'actMetadata' );
    const timestamp = mf.actService.getBerlinTimestamp();

    for ( const actId of actIds ) {
      await updateActMetadata( metadataCollection, actId, timestamp );
    }

    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'count': actIds.length,
      duration
    }, 'Updated lastRequestedAt' );

    logSlowOperation( logger, 'updateLastRequestedAt', duration, {
      'count': actIds.length
    } );
  };

  /**
   * Removes acts that have not been requested for 14 or more updates
   * @returns {Promise<object>} Object with deletedCount property
   * @throws {Error} When not connected or delete not acknowledged
   */
  const removeActsNotRequestedFor14Updates = async () => {
    const { logger, logLevel } = getLogger();

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_026)' );
    }

    const startTime = Date.now();

    logger[ logLevel ]( 'Removing acts not requested for 14+ updates' );

    const staleMetadata = await db.collection( 'actMetadata' ).find( {
      'updatesSinceLastRequest': { '$gte': 14 }
    } ).toArray();

    if ( staleMetadata.length === 0 ) {
      logger[ logLevel ]( { 'deletedCount': 0 }, 'No stale acts found' );

      return { 'deletedCount': 0 };
    }
    const idsToRemove = staleMetadata.map( ( doc ) => doc._id );
    const actsResult = await db.collection( 'acts' ).deleteMany( { '_id': { '$in': idsToRemove } } );

    if ( !actsResult.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_027)' );
    }
    await db.collection( 'actMetadata' ).deleteMany( { '_id': { '$in': idsToRemove } } );

    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'deletedCount': actsResult.deletedCount,
      duration
    }, 'Removed stale acts' );

    logSlowOperation( logger, 'removeActsNotRequestedFor14Updates', duration, {
      'deletedCount': actsResult.deletedCount
    } );

    return { 'deletedCount': actsResult.deletedCount };
  };

  // Extend global namespace (mf is already initialized by database.js)
  globalThis.mf.databaseAdmin = {
    logUpdateError,
    getRecentUpdateErrors,
    ensureErrorCollectionIndexes,
    clearCache,
    updateLastRequestedAt,
    removeActsNotRequestedFor14Updates
  };

  // Expose testing utilities when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.databaseAdmin = {
      getLogger,
      logSlowOperation,
      updateActMetadata
    };
  }
} )();
