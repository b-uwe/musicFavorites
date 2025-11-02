/**
 * MongoDB database connection module
 * @module services/database
 */

( () => {
  'use strict';

  const { MongoClient, ServerApiVersion } = require( 'mongodb' );

  let client = null;

  /**
   * Ensures client is connected
   * @param {string} errorCode - The error code to use if not connected
   * @throws {Error} When not connected to database
   * @returns {void}
   */
  const ensureConnected = ( errorCode ) => {
    if ( !client ) {
      throw new Error( `Service temporarily unavailable. Please try again later. (Error: ${errorCode})` );
    }
  };
  /**
   * Gets the musicfavorites database instance
   * @returns {object} MongoDB database instance
   */
  const getMusicFavoritesDb = () => client.db( 'musicfavorites' );
  /**
   * Gets a collection from the musicfavorites database
   * @param {string} collectionName - The name of the collection
   * @returns {object} MongoDB collection instance
   */
  const getCollection = ( collectionName ) => getMusicFavoritesDb().collection( collectionName );
  /**
   * Sanitizes MongoDB URI for logging by hiding credentials
   * @param {string} uri - The MongoDB connection URI
   * @returns {string} Sanitized URI with credentials replaced by ***
   */
  const sanitizeUriForLogging = ( uri ) => uri.replace( /\/\/.*@/u, '//***@' );
  /**
   * Creates and connects a new MongoClient instance
   * @param {string} uri - The MongoDB connection URI
   * @returns {Promise<object>} Connected MongoClient instance
   */
  const createMongoClient = async ( uri ) => {
    const newClient = new MongoClient( uri, {
      'serverApi': {
        'version': ServerApiVersion.v1,
        'strict': true,
        'deprecationErrors': true
      },
      'serverSelectionTimeoutMS': 10000
    } );
    await newClient.connect();
    return newClient;
  };

  /**
   * Verifies MongoDB connection by pinging the admin database
   * @param {object} mongoClient - The MongoClient instance to verify
   * @returns {Promise<void>} Resolves if ping successful
   * @throws {Error} When ping fails or returns unexpected result
   */
  const verifyConnection = async ( mongoClient ) => {
    const pingResult = await mongoClient.db( 'admin' ).command( {
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
    const uri = process.env.MONGODB_URI;
    if ( !uri ) {
      throw new Error( 'Service misconfigured. Please try again later. (Error: DB_001)' );
    }
    if ( mf.logger ) {
      mf.logger.info( {
        'uri': sanitizeUriForLogging( uri )
      }, 'Connecting to MongoDB' );
    }
    try {
      if ( !client ) {
        client = await createMongoClient( uri );
      }
      await verifyConnection( client );
      if ( mf.logger ) {
        mf.logger.info( 'MongoDB connected successfully' );
      }
    } catch ( error ) {
      client = null;
      if ( error.message && error.message.includes( '(Error: DB_' ) ) {
        throw error;
      }
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
    if ( mf.logger ) {
      mf.logger.info( 'Disconnecting from MongoDB' );
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
    ensureConnected( 'DB_003' );
    return client.db( dbName );
  };

  /**
   * Gets act data from cache
   * @param {string} actId - The MusicBrainz act ID
   * @returns {Promise<object|null>} Cached act data or null if not found
   * @throws {Error} When not connected to database
   */
  const getActFromCache = async ( actId ) => {
    ensureConnected( 'DB_004' );
    if ( mf.logger ) {
      mf.logger.debug( {
        actId
      }, 'Cache lookup' );
    }
    const result = await getCollection( 'acts' ).findOne( {
      '_id': actId
    } );
    if ( !result ) {
      if ( mf.logger ) {
        mf.logger.debug( {
          actId,
          'hit': false
        }, 'Cache miss' );
      }
      return null;
    }
    if ( mf.logger ) {
      mf.logger.debug( {
        actId,
        'hit': true
      }, 'Cache hit' );
    }
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
    ensureConnected( 'DB_005' );
    if ( !actData._id ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_006)' );
    }
    if ( mf.logger ) {
      mf.logger.debug( {
        'actId': actData._id
      }, 'Caching act data' );
    }
    const actsCollection = getCollection( 'acts' );
    const metadataCollection = getCollection( 'actMetadata' );
    const result = await actsCollection.updateOne(
      { '_id': actData._id },
      { '$set': actData },
      { 'upsert': true }
    );
    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_007)' );
    }
    await metadataCollection.updateOne(
      { '_id': actData._id },
      { '$inc': { 'updatesSinceLastRequest': 1 } },
      { 'upsert': true }
    );
  };

  /**
   * Performs health check write operation
   * @param {object} collection - MongoDB collection to write to
   * @param {string} testId - Test document ID
   * @returns {Promise<void>} Resolves if write successful
   * @throws {Error} When write fails or is not acknowledged
   */
  const performHealthCheckWrite = async ( collection, testId ) => {
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
  };

  /**
   * Performs health check delete operation
   * @param {object} collection - MongoDB collection to delete from
   * @param {string} testId - Test document ID
   * @returns {Promise<void>} Resolves if delete successful
   * @throws {Error} When delete fails or is not acknowledged
   */
  const performHealthCheckDelete = async ( collection, testId ) => {
    const deleteResult = await collection.deleteOne( {
      '_id': testId
    } );
    if ( !deleteResult.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_010)' );
    }
  };

  /**
   * Tests cache health with a dummy write-then-delete operation
   * Attempts reconnection if client exists but operations fail
   * @returns {Promise<void>} Resolves if cache is healthy
   * @throws {Error} When cache is unavailable or operations not acknowledged
   */
  const testCacheHealth = async () => {
    ensureConnected( 'DB_008' );
    if ( mf.logger ) {
      mf.logger.debug( 'Testing cache health' );
    }
    try {
      const collection = getCollection( 'acts' );
      const testId = '__health_check__';
      await performHealthCheckWrite( collection, testId );
      await performHealthCheckDelete( collection, testId );
    } catch ( error ) {
      if ( mf.logger ) {
        mf.logger.warn( 'Cache health check failed' );
      }
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
    ensureConnected( 'DB_013' );
    const results = await getCollection( 'acts' ).find( {}, {
      'projection': {
        '_id': 1
      }
    } ).toArray();
    return results.map( ( doc ) => doc._id ).sort();
  };

  /**
   * Gets all acts with metadata from cache
   * @returns {Promise<Array<object>>} Sorted array of acts with _id and updatedAt
   * @throws {Error} When not connected to database
   */
  const getAllActsWithMetadata = async () => {
    ensureConnected( 'DB_014' );
    const results = await getCollection( 'acts' ).find( {}, {
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
    ensureConnected( 'DB_015' );
    const results = await getCollection( 'acts' ).find(
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
    return results.map( ( doc ) => doc._id ).sort();
  };

  /**
   * Logs a data update error to the database
   * @param {object} errorData - Error information
   * @returns {Promise<void>} Resolves when error is logged
   * @throws {Error} When not connected, missing required fields, or write not acknowledged
   */
  const logUpdateError = async ( errorData ) => {
    ensureConnected( 'DB_016' );
    if ( !errorData.timestamp || !errorData.actId || !errorData.errorMessage || !errorData.errorSource ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_017)' );
    }
    const result = await getCollection( 'dataUpdateErrors' ).insertOne( {
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
    ensureConnected( 'DB_019' );
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate( sevenDaysAgo.getDate() - 7 );
    const results = await getCollection( 'dataUpdateErrors' ).find(
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
    ensureConnected( 'DB_020' );
    await getCollection( 'dataUpdateErrors' ).createIndex(
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
    ensureConnected( 'DB_021' );
    const result = await getCollection( 'acts' ).deleteMany( {} );
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
    ensureConnected( 'DB_023' );
    if ( !Array.isArray( actIds ) || actIds.length === 0 ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_024)' );
    }
    require( './actService' );
    const metadataCollection = getCollection( 'actMetadata' );
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
    ensureConnected( 'DB_026' );

    const db = getMusicFavoritesDb();
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
