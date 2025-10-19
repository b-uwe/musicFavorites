/**
 * MongoDB database connection module
 * @module services/database
 */

const { MongoClient, ServerApiVersion } = require( 'mongodb' );

let client = null;

/**
 * Connects to MongoDB database
 * @returns {Promise<void>} Resolves when connection is established
 * @throws {Error} When MONGODB_URI is not set or connection fails
 */
const connect = async () => {
  if ( client ) {
    return;
  }

  const uri = process.env.MONGODB_URI;

  if ( !uri ) {
    throw new Error( 'Service misconfigured. Please try again later. (Error: DB_001)' );
  }

  try {
    client = new MongoClient( uri, {
      'serverApi': {
        'version': ServerApiVersion.v1,
        'strict': true,
        'deprecationErrors': true
      }
    } );

    await client.connect();

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
 * Gets artist data from cache
 * @param {string} artistId - The MusicBrainz artist ID
 * @returns {Promise<object|null>} Cached artist data or null if not found
 * @throws {Error} When not connected to database
 */
const getArtistFromCache = async ( artistId ) => {
  if ( !client ) {
    throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_004)' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );

  const result = await collection.findOne( {
    '_id': artistId
  } );

  if ( !result ) {
    return null;
  }

  // Map MongoDB _id to musicbrainzId for API response
  const { _id, ...artistData } = result;

  return {
    'musicbrainzId': _id,
    ...artistData
  };
};

/**
 * Caches artist data in database
 * @param {object} artistData - Transformed artist data to cache
 * @returns {Promise<void>} Resolves when artist is cached
 * @throws {Error} When not connected, artistData missing _id, or write not acknowledged
 */
const cacheArtist = async ( artistData ) => {
  if ( !client ) {
    throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_005)' );
  }

  if ( !artistData._id ) {
    throw new Error( 'Invalid request. Please try again later. (Error: DB_006)' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );

  const result = await collection.updateOne(
    {
      '_id': artistData._id
    },
    {
      '$set': artistData
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
 * @returns {Promise<void>} Resolves if cache is healthy
 * @throws {Error} When cache is unavailable or operations not acknowledged
 */
const testCacheHealth = async () => {
  if ( !client ) {
    throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_008)' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );
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
  const collection = db.collection( 'artists' );

  const results = await collection.find( {}, {
    'projection': {
      '_id': 1
    }
  } ).toArray();

  const ids = results.map( ( doc ) => doc._id );

  return ids.sort();
};

module.exports = {
  connect,
  disconnect,
  getDatabase,
  getArtistFromCache,
  cacheArtist,
  testCacheHealth,
  getAllActIds
};
