/**
 * MongoDB database connection module
 * @module services/database
 */

( () => {
  'use strict';

  const { MongoClient, ServerApiVersion } = require( 'mongodb' );

  let client = null;

  /**
   * Connects to MongoDB database
   * @returns {Promise<void>} Resolves when connection is established
   * @throws {Error} When MONGODB_URI is not set or connection fails
   */
  const connect = async () => {
    const uri = process.env.MONGODB_URI;

    if ( !uri ) {
      throw new Error( 'Service misconfigured. Please try again later. (Error: DB_001)' );
    }

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

      // Ping to confirm successful connection
      const pingResult = await client.db( 'admin' ).command( {
        'ping': 1
      } );

      // Verify ping response
      if ( pingResult.ok !== 1 ) {
        throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_002)' );
      }
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
    if ( !client ) {
      return;
    }

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
   * Gets act data from cache
   * @param {string} actId - The MusicBrainz act ID
   * @returns {Promise<object|null>} Cached act data or null if not found
   * @throws {Error} When not connected to database
   */
  const getActFromCache = async ( actId ) => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_004)' );
    }

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const result = await collection.findOne( {
      '_id': actId
    } );

    if ( !result ) {
      return null;
    }

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
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_005)' );
    }

    if ( !actData._id ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_006)' );
    }

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
  };

  /**
   * Tests cache health with a dummy write-then-delete operation
   * Attempts reconnection if client exists but operations fail
   * @returns {Promise<void>} Resolves if cache is healthy
   * @throws {Error} When cache is unavailable or operations not acknowledged
   */
  const testCacheHealth = async () => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_008)' );
    }

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
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_013)' );
    }

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const results = await collection.find( {}, {
      'projection': {
        '_id': 1
      }
    } ).toArray();

    const ids = results.map( ( doc ) => doc._id );

    return ids.sort();
  };

  /**
   * Gets all acts with metadata from cache
   * @returns {Promise<Array<object>>} Sorted array of acts with _id and updatedAt
   * @throws {Error} When not connected to database
   */
  const getAllActsWithMetadata = async () => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_014)' );
    }

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const results = await collection.find( {}, {
      'projection': {
        '_id': 1,
        'updatedAt': 1
      }
    } ).toArray();

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
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_015)' );
    }

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

    return ids.sort();
  };

  /**
   * Logs a data update error to the database
   * @param {object} errorData - Error information
   * @returns {Promise<void>} Resolves when error is logged
   * @throws {Error} When not connected, missing required fields, or write not acknowledged
   */
  const logUpdateError = async ( errorData ) => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_016)' );
    }

    if ( !errorData.timestamp || !errorData.actId || !errorData.errorMessage || !errorData.errorSource ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_017)' );
    }

    const db = client.db( 'musicfavorites' );
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
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_019)' );
    }

    const db = client.db( 'musicfavorites' );
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

    return results;
  };

  /**
   * Ensures TTL index exists on dataUpdateErrors collection
   * @returns {Promise<void>} Resolves when index is created or already exists
   * @throws {Error} When not connected to database
   */
  const ensureErrorCollectionIndexes = async () => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_020)' );
    }

    const db = client.db( 'musicfavorites' );
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
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_021)' );
    }

    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'acts' );

    const result = await collection.deleteMany( {} );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_022)' );
    }
  };

  /**
   * Updates lastRequestedAt and resets updatesSinceLastRequest for requested acts
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs
   * @returns {Promise<void>} Resolves when all acts are updated
   * @throws {Error} When not connected, actIds invalid, or update not acknowledged
   */
  const updateLastRequestedAt = async ( actIds ) => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_023)' );
    }
    if ( !Array.isArray( actIds ) || actIds.length === 0 ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_024)' );
    }
    require( './actService' );
    const db = client.db( 'musicfavorites' );
    const metadataCollection = db.collection( 'actMetadata' );
    const timestamp = mf.actService.getBerlinTimestamp();
    for ( const actId of actIds ) {
      const result = await metadataCollection.updateOne(
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
    }
  };

  /**
   * Removes acts that have not been requested for 14 or more updates
   * @returns {Promise<object>} Object with deletedCount property
   * @throws {Error} When not connected or delete not acknowledged
   */
  const removeActsNotRequestedFor14Updates = async () => {
    if ( !client ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_026)' );
    }

    const db = client.db( 'musicfavorites' );
    const staleMetadata = await db.collection( 'actMetadata' ).find( {
      'updatesSinceLastRequest': { '$gte': 14 }
    } ).toArray();
    if ( staleMetadata.length === 0 ) {
      return { 'deletedCount': 0 };
    }
    const idsToRemove = staleMetadata.map( ( doc ) => doc._id );
    const actsResult = await db.collection( 'acts' ).deleteMany( { '_id': { '$in': idsToRemove } } );
    if ( !actsResult.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_027)' );
    }
    await db.collection( 'actMetadata' ).deleteMany( { '_id': { '$in': idsToRemove } } );
    return { 'deletedCount': actsResult.deletedCount };
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.database = {
    connect,
    disconnect,
    getActFromCache,
    cacheAct,
    testCacheHealth,
    getAllActIds,
    getAllActsWithMetadata,
    getActsWithoutBandsintown,
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
    globalThis.mf.testing.database = {
      client,
      getDatabase
    };
  }
} )();
