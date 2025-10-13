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
    throw new Error( 'MONGODB_URI environment variable is not set' );
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
      throw new Error( 'MongoDB ping verification failed' );
    }
  } catch ( error ) {
    // Reset client on any failure to allow retry
    client = null;
    throw error;
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

  await client.close();
  // Only reset client after successful close
  client = null;
};

/**
 * Gets database instance
 * @param {string} dbName - The database name to use
 * @returns {object} MongoDB database instance
 * @throws {Error} When not connected to database
 */
const getDatabase = ( dbName ) => {
  if ( !client ) {
    throw new Error( 'Database not connected. Call connect() first.' );
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
    throw new Error( 'Database not connected. Call connect() first.' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );

  const result = await collection.findOne( {
    'musicbrainzId': artistId
  } );

  return result;
};

/**
 * Caches artist data in database
 * @param {object} artistData - Transformed artist data to cache
 * @returns {Promise<void>} Resolves when artist is cached
 * @throws {Error} When not connected, artistData missing musicbrainzId, or write not acknowledged
 */
const cacheArtist = async ( artistData ) => {
  if ( !client ) {
    throw new Error( 'Database not connected. Call connect() first.' );
  }

  if ( !artistData.musicbrainzId ) {
    throw new Error( 'Artist data must include musicbrainzId' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );

  const result = await collection.updateOne(
    {
      'musicbrainzId': artistData.musicbrainzId
    },
    {
      '$set': artistData
    },
    {
      'upsert': true
    }
  );

  if ( !result.acknowledged ) {
    throw new Error( 'Cache write not acknowledged by database' );
  }
};

/**
 * Tests cache health with a dummy write-then-delete operation
 * @returns {Promise<void>} Resolves if cache is healthy
 * @throws {Error} When cache is unavailable or operations not acknowledged
 */
const testCacheHealth = async () => {
  if ( !client ) {
    throw new Error( 'Database not connected. Call connect() first.' );
  }

  const db = client.db( 'musicfavorites' );
  const collection = db.collection( 'artists' );
  const testId = '__health_check__';

  // Write dummy document
  const writeResult = await collection.updateOne(
    {
      'musicbrainzId': testId
    },
    {
      '$set': {
        'musicbrainzId': testId,
        'name': 'Health Check',
        'testEntry': true
      }
    },
    {
      'upsert': true
    }
  );

  if ( !writeResult.acknowledged ) {
    throw new Error( 'Health check write not acknowledged by database' );
  }

  // Immediately delete it
  const deleteResult = await collection.deleteOne( {
    'musicbrainzId': testId
  } );

  if ( !deleteResult.acknowledged ) {
    throw new Error( 'Health check delete not acknowledged by database' );
  }
};

module.exports = {
  connect,
  disconnect,
  getDatabase,
  getArtistFromCache,
  cacheArtist,
  testCacheHealth
};
