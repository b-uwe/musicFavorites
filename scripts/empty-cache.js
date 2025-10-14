/**
 * Utility script to empty MongoDB cache collection
 * @module scripts/empty-cache
 */

require( 'dotenv' ).config();
const { MongoClient, ServerApiVersion } = require( 'mongodb' );

/**
 * Empties the MongoDB cache collection by deleting all documents
 * @returns {Promise<void>} Resolves when cache is emptied
 * @throws {Error} When MONGODB_URI is not set or operation fails
 */
const emptyCache = async () => {
  const uri = process.env.MONGODB_URI;

  if ( !uri ) {
    throw new Error( 'MONGODB_URI not set in environment' );
  }

  const client = new MongoClient( uri, {
    'serverApi': {
      'version': ServerApiVersion.v1,
      'strict': true,
      'deprecationErrors': true
    }
  } );

  try {
    await client.connect();
    const db = client.db( 'musicfavorites' );
    const collection = db.collection( 'artists' );

    const result = await collection.deleteMany( {} );

    console.log( `✓ Deleted ${result.deletedCount} documents from cache` );
  } finally {
    await client.close();
  }
};

emptyCache().catch( ( error ) => {
  console.error( 'Error emptying cache:', error.message );
  process.exit( 1 );
} );
