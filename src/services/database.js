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

module.exports = {
  connect,
  disconnect,
  getDatabase
};
