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
    const collection = db.collection( 'acts' );

    const result = await collection.updateOne(
      {
        '_id': actData._id
      },
      {
        '$set': actData
      },
      {
        'upsert': true
      }
    );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_007)' );
    }
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
    getActsWithoutBandsintown
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
