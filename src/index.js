/**
 * Server entry point
 * Starts the Express server on the configured port
 */

require( 'dotenv' ).config();
const app = require( './app' );
const { connect } = require( './services/database' );

const PORT = process.env.PORT || 3000;

/**
 * Starts the server and attempts to connect to MongoDB
 * Server starts regardless of database connection status
 * @returns {Promise<void>} Resolves when server is ready
 */
const startServer = async () => {
  // Start Express server first (always succeeds)
  app.listen( PORT, () => {
    console.log( `Music Favorites API running on port ${PORT}` );
  } );

  // Attempt MongoDB connection (non-blocking)
  try {
    await connect();
    console.log( 'Connected to MongoDB successfully' );
  } catch ( error ) {
    console.error( 'MongoDB connection failed:', error.message );
    console.error( 'Server running but database unavailable. API will return errors.' );
  }
};

startServer();
