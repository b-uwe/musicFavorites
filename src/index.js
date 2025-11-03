/**
 * Server entry point
 * Starts the Express server on the configured port
 */

( () => {
  'use strict';

  require( 'dotenv' ).config();
  require( './app' );
  require( './services/database' );
  require( './services/cacheUpdater' );

  const PORT = process.env.PORT || 3000;

  /**
   * Starts the server and attempts to connect to MongoDB
   * Server starts regardless of database connection status
   * @returns {Promise<void>} Resolves when server is ready
   */
  const startServer = async () => {
    // Start Express server first (always succeeds)
    const server = mf.app.listen( PORT, () => {
      mf.logger.info( {
        'port': PORT,
        'env': process.env.NODE_ENV
      }, 'Server started' );
    } );

    // Register graceful shutdown handlers
    process.on( 'SIGTERM', () => {
      mf.logger.info( {
        'signal': 'SIGTERM'
      }, 'Received shutdown signal' );
      mf.gracefulShutdown( server );
    } );
    process.on( 'SIGINT', () => {
      mf.logger.info( {
        'signal': 'SIGINT'
      }, 'Received shutdown signal' );
      mf.gracefulShutdown( server );
    } );

    // Attempt MongoDB connection (non-blocking)
    try {
      await mf.database.connect();
      mf.logger.info( 'Connected to MongoDB successfully' );

      // Start background cache update cycle (fire-and-forget)
      mf.cacheUpdater.start().catch( ( error ) => {
        mf.logger.error( {
          'err': error
        }, 'Cache updater crashed' );
      } );
    } catch ( error ) {
      mf.logger.error( {
        'err': error
      }, 'MongoDB connection failed' );
      mf.logger.warn( 'Server running but database unavailable' );
    }
  };

  startServer();
} )();
