/**
 * Server entry point
 * Starts the Express server on the configured port
 */

require( 'dotenv' ).config();
const app = require( './app' );
const { connect } = require( './services/database' );

const PORT = process.env.PORT || 3000;

/**
 * Starts the server and connects to MongoDB
 * @returns {Promise<void>} Resolves when server and database are ready
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connect();
    console.log( 'Connected to MongoDB successfully' );

    // Start Express server
    app.listen( PORT, () => {
      console.log( `Music Favorites API running on port ${PORT}` );
    } );
  } catch ( error ) {
    console.error( 'Failed to start server:', error.message );
    process.exit( 1 );
  }
};

startServer();
