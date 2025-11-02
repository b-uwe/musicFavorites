/**
 * MongoDB database connection module
 * @module services/database
 */

( () => {
  'use strict';

  const { MongoClient, ServerApiVersion } = require( 'mongodb' );

  // Load constants module
  require( '../constants' );

  let client = null;

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
   * Verifies MongoDB connection with ping command
   * @returns {Promise<void>} Resolves if ping successful
   * @throws {Error} When ping fails
   */
  const verifyConnection = async () => {
    const pingResult = await client.db( 'admin' ).command( {
      'ping': 1
    } );

    if ( pingResult.ok !== 1 ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_002)' );
    }
  };

  /**
   * Connects to MongoDB database
   * @returns {Promise<void>} Resolves when connection is established
   * @throws {Error} When MONGODB_URI is not set or connection fails
   */
  const connect = async () => {
    const { 'MONGODB_URI': uri } = process.env;
    const { logger, logLevel } = getLogger( 'info' );

    if ( !uri ) {
      throw new Error( 'Service misconfigured. Please try again later. (Error: DB_001)' );
    }

    // Sanitize URI for logging
    const sanitizedUri = uri.replace( /\/\/.*@/u, '//***@' );

    logger[ logLevel ]( {
      'uri': sanitizedUri
    }, 'Connecting to MongoDB' );

    try {
      if ( !client ) {
        client = new MongoClient( uri, {
          'serverApi': {
            'version': ServerApiVersion.v1,
            'strict': true,
            'deprecationErrors': true
          },
          'serverSelectionTimeoutMS': 10000
        } );

        await client.connect();
      }

      await verifyConnection();

      logger[ logLevel ]( 'MongoDB connected successfully' );
    } catch ( error ) {
      // Reset client on any failure to allow retry
      client = null;
      // If it's already a formatted error code, re-throw it unchanged
      if ( error.message && error.message.includes( '(Error: DB_' ) ) {
        throw error;
      }
      // Otherwise wrap raw errors in consumer-friendly message
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_011)' );
    }
  };

  /**
   * Disconnects from MongoDB database
   * @returns {Promise<void>} Resolves when disconnection is complete
   * @throws {Error} When disconnection fails
   */
  const disconnect = async () => {
    const { logger, logLevel } = getLogger( 'info' );

    if ( !client ) {
      return;
    }

    logger[ logLevel ]( 'Disconnecting from MongoDB' );

    try {
      await client.close();
      // Only reset client after successful close
      client = null;
    } catch ( error ) {
      // Wrap disconnection errors in consumer-friendly message
      throw new Error( 'Service temporarily unavailable during disconnection. (Error: DB_012)' );
    }
  };

  /**
   * Gets database instance
   * @param {string} dbName - The database name to use
   * @returns {object} MongoDB database instance
   * @throws {Error} When not connected to database
   */
  const getDatabase = ( dbName ) => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_003)' );
    }

    return client.db( dbName );
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
   * Gets act data from cache
   * @param {string} actId - The MusicBrainz act ID
   * @returns {Promise<object|null>} Cached act data or null if not found
   * @throws {Error} When not connected to database
   */
  const getActFromCache = async ( actId ) => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_004)' );
    }

    const startTime = Date.now();

    logger[ logLevel ]( {
      actId
    }, 'Cache lookup' );

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const result = await collection.findOne( {
      '_id': actId
    } );
    const duration = Date.now() - startTime;

    if ( !result ) {
      logger[ logLevel ]( {
        actId,
        'hit': false,
        duration
      }, 'Cache miss' );

      return null;
    }

    logger[ logLevel ]( {
      actId,
      'hit': true,
      duration
    }, 'Cache hit' );

    logSlowOperation( logger, 'getActFromCache', duration, {
      actId
    } );

    // Map MongoDB _id to musicbrainzId for API response
    const { _id, ...actData } = result;

    return {
      'musicbrainzId': _id,
      ...actData
    };
  };

  /**
   * Caches act data in database
   * @param {object} actData - Transformed act data to cache
   * @returns {Promise<void>} Resolves when act is cached
   * @throws {Error} When not connected, actData missing _id, or write not acknowledged
   */
  const cacheAct = async ( actData ) => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_005)' );
    }

    if ( !actData._id ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_006)' );
    }

    const actId = actData._id;
    const startTime = Date.now();

    logger[ logLevel ]( { actId }, 'Caching act data' );

    const db = client.db( 'musicfavorites' );
    const actsCollection = db.collection( 'acts' );
    const metadataCollection = db.collection( 'actMetadata' );

    // Store public act data
    const result = await actsCollection.updateOne(
      { '_id': actData._id },
      { '$set': actData },
      { 'upsert': true }
    );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_007)' );
    }

    // Update internal tracking metadata in separate collection
    await metadataCollection.updateOne(
      { '_id': actData._id },
      { '$inc': { 'updatesSinceLastRequest': 1 } },
      { 'upsert': true }
    );

    const duration = Date.now() - startTime;

    logSlowOperation( logger, 'cacheAct', duration, {
      actId
    } );
  };

  /**
   * Tests cache health with a dummy write-then-delete operation
   * Attempts reconnection if client exists but operations fail
   * @returns {Promise<void>} Resolves if cache is healthy
   * @throws {Error} When cache is unavailable or operations not acknowledged
   */
  const testCacheHealth = async () => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_008)' );
    }

    logger[ logLevel ]( 'Testing cache health' );

    try {
      const db = client.db( 'musicfavorites' );
      const collection = db.collection( 'acts' );
      const testId = '__health_check__';

      // Write dummy document
      const writeResult = await collection.updateOne(
        {
          '_id': testId
        },
        {
          '$set': {
            '_id': testId,
            'name': 'Health Check',
            'testEntry': true
          }
        },
        {
          'upsert': true
        }
      );

      if ( !writeResult.acknowledged ) {
        throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_009)' );
      }

      // Immediately delete it
      const deleteResult = await collection.deleteOne( {
        '_id': testId
      } );

      if ( !deleteResult.acknowledged ) {
        throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_010)' );
      }
    } catch ( error ) {
      logger.warn( 'Cache health check failed' );
      // If health check fails, reset client to allow reconnection on next attempt
      client = null;
      throw error;
    }
  };

  /**
   * Gets all act IDs from cache
   * @returns {Promise<Array<string>>} Sorted array of all cached act IDs
   * @throws {Error} When not connected to database
   */
  const getAllActIds = async () => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_013)' );
    }

    const startTime = Date.now();

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const results = await collection.find( {}, {
      'projection': {
        '_id': 1
      }
    } ).toArray();

    const ids = results.map( ( doc ) => doc._id );
    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'count': ids.length,
      duration
    }, 'Retrieved all act IDs' );

    logSlowOperation( logger, 'getAllActIds', duration, {
      'count': ids.length
    } );

    return ids.sort();
  };

  /**
   * Gets all acts with metadata from cache
   * @returns {Promise<Array<object>>} Sorted array of acts with _id and updatedAt
   * @throws {Error} When not connected to database
   */
  const getAllActsWithMetadata = async () => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_014)' );
    }

    const startTime = Date.now();

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const results = await collection.find( {}, {
      'projection': {
        '_id': 1,
        'updatedAt': 1
      }
    } ).toArray();

    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'count': results.length,
      duration
    }, 'Retrieved acts with metadata' );

    logSlowOperation( logger, 'getAllActsWithMetadata', duration, {
      'count': results.length
    } );

    return results.sort( ( a, b ) => {
      if ( a._id < b._id ) {
        return -1;
      }

      if ( a._id > b._id ) {
        return 1;
      }

      return 0;
    } );
  };

  /**
   * Gets all acts without Bandsintown relation from cache
   * @returns {Promise<Array<string>>} Sorted array of MusicBrainz IDs without Bandsintown links
   * @throws {Error} When not connected to database
   */
  const getActsWithoutBandsintown = async () => {
    const { logger, logLevel } = getLogger();

    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_015)' );
    }

    const startTime = Date.now();

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const results = await collection.find(
      {
        '$or': [
          { 'relations.bandsintown': { '$exists': false } },
          { 'relations.bandsintown': null }
        ]
      },
      {
        'projection': {
          '_id': 1
        }
      }
    ).toArray();

    const ids = results.map( ( doc ) => doc._id );
    const duration = Date.now() - startTime;

    logger[ logLevel ]( {
      'count': ids.length,
      duration
    }, 'Retrieved acts without Bandsintown' );

    logSlowOperation( logger, 'getActsWithoutBandsintown', duration, {
      'count': ids.length
    } );

    return ids.sort();
  };


  // Extend global namespace (mf is already initialized by constants.js)
  globalThis.mf.database = {
    connect,
    disconnect,
    getActFromCache,
    cacheAct,
    testCacheHealth,
    getAllActIds,
    getAllActsWithMetadata,
    getActsWithoutBandsintown,
    getDatabase
  };

  // Expose testing utilities when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.database = {
      client,
      getDatabase,
      getLogger,
      logSlowOperation
    };
  }

  // Load databaseAdmin module to extend mf namespace
  require( './databaseAdmin' );
} )();
