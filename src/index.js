/**
 * Server entry point
 * Starts the Express server on the configured port
 */

( () => {
  'use strict';

  require( 'dotenv' ).config();
  require( './app' );
  require( './services/database' );
  const cacheUpdater = require( './services/cacheUpdater' );

  const PORT = process.env.PORT || 3000;

  /**
   * Starts the server and attempts to connect to MongoDB
   * Server starts regardless of database connection status
   * @returns {Promise<void>} Resolves when server is ready
   */
  const startServer = async () => {
    // Start Express server first (always succeeds)
    mf.app.listen( PORT, () => {
      console.log( `Music Favorites API running on port ${PORT}` );
    } );

    // Attempt MongoDB connection (non-blocking)
    try {
      await mf.database.connect();
      console.log( 'Connected to MongoDB successfully' );

      // Start background cache update cycle (fire-and-forget)
      cacheUpdater.start().catch( ( error ) => {
        console.error( 'Cache updater crashed:', error.message );
      } );
    } catch ( error ) {
      console.error( 'MongoDB connection failed:', error.message );
      console.error( 'Server running but database unavailable. API will return errors.' );
    }
  };

  startServer();
} )();
