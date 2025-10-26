/**
 * Admin routes
 * @module routes/admin
 */

( () => {
  'use strict';

  const express = require( 'express' );
  require( '../middleware/adminAuth' );
  require( '../middleware/requestStats' );
  require( '../services/database' );

  // eslint-disable-next-line new-cap
  const router = express.Router();

  /**
   * Gets the most recent cache update timestamp
   * @param {Array<object>} actsWithMetadata - Array of acts with metadata
   * @returns {string|null} Most recent update timestamp or null
   */
  const getLastCacheUpdate = ( actsWithMetadata ) => {
    const actsWithTimestamps = actsWithMetadata.filter( ( act ) => act.updatedAt );

    if ( actsWithTimestamps.length === 0 ) {
      return null;
    }

    const mostRecent = actsWithTimestamps.reduce( ( latest, current ) => {
      const currentDate = new Date( current.updatedAt );
      const latestDate = new Date( latest.updatedAt );

      return currentDate > latestDate ? current : latest;
    } );

    return mostRecent.updatedAt;
  };

  /**
   * Health check endpoint handler
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {object} JSON response with health data or error
   */
  const healthHandler = async ( req, res ) => {
    try {
      const actIds = await mf.database.getAllActIds();
      const cacheSize = actIds.length;

      let lastCacheUpdate = null;

      if ( cacheSize > 0 ) {
        const actsWithMetadata = await mf.database.getAllActsWithMetadata();

        lastCacheUpdate = getLastCacheUpdate( actsWithMetadata );
      }

      const memUsage = process.memoryUsage();
      const memoryUsage = {
        'heapUsed': memUsage.heapUsed,
        'heapTotal': memUsage.heapTotal,
        'rss': memUsage.rss
      };

      const uptime = process.uptime();
      const requestStats = mf.requestStats.getStats();

      return res.json( {
        'status': 'ok',
        cacheSize,
        lastCacheUpdate,
        memoryUsage,
        uptime,
        requestStats
      } );
    } catch ( error ) {
      return res.status( 500 ).json( {
        'error': 'Failed to fetch health data'
      } );
    }
  };

  /**
   * Health check endpoint with system metrics
   * GET /admin/health
   * Requires TOTP authentication via Authorization header
   * @returns {object} Health status with cache size, uptime, memory, and request stats
   */
  router.get( '/health', mf.adminAuth, healthHandler );

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.adminRoutes = router;
} )();
