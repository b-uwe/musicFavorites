/**
 * Express application configuration
 * @module app
 */

( () => {
  'use strict';

  const express = require( 'express' );
  const path = require( 'path' );
  const speakeasy = require( 'speakeasy' );
  require( './services/actService' );

  const app = express();

  // Parse plain text request bodies
  app.use( express.text() );
  const usageStats = {
    'requests': 0,
    'actsQueried': 0
  };

  /**
   * Standard meta object for all API responses
   * @type {object}
   */
  const META = {
    'attribution': {
      'sources': [ 'MusicBrainz', 'Bandsintown', 'Songkick' ],
      'notice': 'Data from third-party sources subject to their respective terms.\n' +
        'See https://github.com/b-uwe/musicFavorites/blob/main/DATA_NOTICE.md for details.'
    },
    'license': 'AGPL-3.0',
    'repository': 'https://github.com/b-uwe/musicFavorites'
  };

  /**
   * Validate Authentication for the Admin route
   * @param {object} req - Express request object
   * @returns {object} - info about how to react to the request
   */
  const validateAdminAuth = ( req ) => {
    const totpConfigJson = process.env.ADMIN_TOTP_CONFIG;
    if ( !totpConfigJson ) {
      return {
        'status': 500,
        'error': 'Admin authentication not configured'
      };
    }

    let totpConfig;
    try {
      totpConfig = JSON.parse( totpConfigJson );
    } catch ( error ) {
      return {
        'status': 500,
        'error': 'Admin authentication misconfigured'
      };
    }

    const authHeader = req.headers.authorization;
    if ( !authHeader ) {
      return {
        'status': 401,
        'error': 'Unauthorized'
      };
    }

    const headerMatch = authHeader.match( new RegExp( `pass ${process.env.ADMIN_PASS}, bearer (?<token>.+)$`, 'ui' ) );
    if ( !headerMatch || !headerMatch.groups ) {
      return {
        'status': 401,
        'error': 'Unauthorized'
      };
    }

    const verified = speakeasy.totp.verify( {
      ...totpConfig,
      'token': headerMatch.groups.token.trim()
    } );

    if ( !verified ) {
      return {
        'status': 401,
        'error': 'Unauthorized'
      };
    }

    return { 'status': 200 };
  };

  /**
   * Sets response headers for cache control and robots
   * @param {object} res - Express response object
   * @returns {void}
   */
  const setResponseHeaders = ( res ) => {
    // TODO: Remove robots blocking once caching layer is in place to protect upstream providers
    res.set( 'X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet' );

    /*
     * TODO: Implement proper caching strategy with ETags and Cache-Control max-age
     * For now, disable all caching
     */
    res.set( 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate' );
    res.set( 'Pragma', 'no-cache' );
    res.set( 'Expires', '0' );
  };

  /**
   * Deduplicate an array of act IDs while preserving order of first occurrence
   * @param {Array<string>} actIds - Array of act IDs that may contain duplicates
   * @returns {Array<string>} Array of unique act IDs in order of first occurrence
   */
  const deduplicateActIds = ( actIds ) => [ ...new Set( actIds ) ];

  /**
   * Handle act data fetching for both GET and POST routes
   * @param {Array} actIds - Array of act IDs to fetch
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {object} Acts information with attribution and metadata
   */
  const handleActsRequest = async ( actIds, req, res ) => {
    usageStats.requests++;

    // Enable pretty-printing if ?pretty query parameter is present
    if ( 'pretty' in req.query ) {
      app.set( 'json spaces', 2 );
    } else {
      app.set( 'json spaces', 0 );
    }

    setResponseHeaders( res );

    try {
      usageStats.actsQueried += actIds.length;

      const result = await mf.actService.fetchMultipleActs( actIds );

      if ( result.error ) {
        return res.status( 503 ).json( {
          'meta': META,
          'type': 'error',
          'error': result.error
        } );
      }

      // Track request timestamp and reset update counter (non-blocking)
      mf.database.updateLastRequestedAt( actIds ).catch( () => {
        // Silent fail - don't block response
      } );

      return res.json( {
        'meta': META,
        'type': 'acts',
        'acts': result.acts
      } );
    } catch ( error ) {
      return res.status( 500 ).json( {
        'meta': META,
        'type': 'error',
        'error': {
          'message': 'Failed to fetch act data',
          'details': error.message
        }
      } );
    }
  };

  /**
   * Get information about one or more music acts
   * Supports comma-separated MusicBrainz IDs for multiple acts
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<object>} Acts information with attribution and metadata
   */
  app.get( '/acts/:id', ( req, res ) => {
    const { id } = req.params;
    const actIds = deduplicateActIds( id.split( ',' ).map( ( actId ) => actId.trim() ) );

    return handleActsRequest( actIds, req, res );
  } );

  /**
   * Post information about one or more music acts
   * Accepts comma-separated MusicBrainz IDs as plain text in request body for handling large lists
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<object>} Acts information with attribution and metadata
   */
  app.post( '/acts', ( req, res ) => {
    const ids = req.body;

    // Validate request body
    if ( !ids || typeof ids !== 'string' || ids.trim().length === 0 ) {
      return res.status( 400 ).json( {
        'meta': META,
        'type': 'error',
        'error': {
          'message': 'Invalid request body',
          'details': 'Request body must be a non-empty comma-separated string of act IDs'
        }
      } );
    }

    // Parse comma-separated IDs and deduplicate
    const actIds = deduplicateActIds( ids.split( ',' ).map( ( actId ) => actId.trim() ) );

    return handleActsRequest( actIds, req, res );
  } );

  /**
   * Serve robots.txt file
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {void} Sends robots.txt file
   */
  app.get( '/robots.txt', ( req, res ) => {
    const robotsPath = path.join( __dirname, '..', 'robots.txt' );

    return res.sendFile( robotsPath, {
      'headers': {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    } );
  } );

  /**
   * Simple health check endpoint for load balancers and monitoring
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<object>} Health status JSON response
   */
  app.get( '/health', async ( req, res ) => {
    res.setHeader( 'Cache-Control', 'no-cache, no-store, must-revalidate' );

    try {
      // Quick database health check
      await mf.database.testCacheHealth();

      return res.status( 200 ).json( {
        'status': 'healthy',
        'timestamp': new Date().toISOString(),
        'uptime': process.uptime()
      } );
    } catch ( error ) {
      return res.status( 503 ).json( {
        'status': 'unhealthy',
        'reason': 'database_unavailable',
        'timestamp': new Date().toISOString()
      } );
    }
  } );

  /**
   * Calculate last cache update stats from acts with metadata
   * @param {Array<object>} actsWithMetadata - Array of acts with updatedAt timestamps
   * @returns {object|null} Object with newest and oldest update info, or null if empty
   */
  const calculateLastCacheUpdate = ( actsWithMetadata ) => actsWithMetadata.
    filter( ( act ) => act.updatedAt )?.
    reduce( ( acc, current ) => {
      if ( !acc?.newest || current.updatedAt > acc.newest.updatedAt ) {
        acc.newest = current;
      }
      if ( !acc?.oldest || current.updatedAt < acc.oldest.updatedAt ) {
        acc.oldest = current;
      }
      return acc;
    }, {} );

  /**
   * Health Status
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {void} Returns a health Status
   */
  app.get( '/admin/health', async ( req, res ) => {
    app.set( 'json spaces', 2 );

    setResponseHeaders( res );

    // Validate authentication first
    const adminAuth = validateAdminAuth( req );
    if ( adminAuth?.status !== 200 ) {
      return res.status( adminAuth.status ).json( {
        'error': adminAuth.error
      } );
    }

    try {
      const actIds = await mf.database.getAllActIds();
      const cacheSize = actIds.length;

      let lastCacheUpdate = null;

      if ( cacheSize > 0 ) {
        const actsWithMetadata = await mf.database.getAllActsWithMetadata();

        lastCacheUpdate = calculateLastCacheUpdate( actsWithMetadata );
      }

      const artistsWithoutBandsintown = await mf.database.getActsWithoutBandsintown();
      const dataUpdateErrors = await mf.database.getRecentUpdateErrors();

      return res.json( {
        'status': 'ok',
        cacheSize,
        lastCacheUpdate,
        artistsWithoutBandsintown,
        dataUpdateErrors,
        'uptime': process.uptime(),
        usageStats
      } );
    } catch ( error ) {
      return res.status( 500 ).json( {
        'error': 'Failed to fetch health data',
        'details': error.message
      } );
    }
  } );

  /**
   * Clear Cache
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {void} Returns cache flush confirmation
   */
  app.delete( '/admin/health/cache', async ( req, res ) => {
    app.set( 'json spaces', 2 );

    setResponseHeaders( res );

    // Validate authentication first
    const adminAuth = validateAdminAuth( req );
    if ( adminAuth?.status !== 200 ) {
      return res.status( adminAuth.status ).json( {
        'error': adminAuth.error
      } );
    }

    try {
      await mf.database.clearCache();

      return res.json( {
        'status': 'ok',
        'message': 'Cache cleared successfully'
      } );
    } catch ( error ) {
      return res.status( 500 ).json( {
        'error': 'Failed to clear cache',
        'details': error.message
      } );
    }
  } );

  /**
   * Handle 404 errors with JSON response
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {object} JSON error response
   */
  app.use( ( req, res ) => res.status( 404 ).json( {
    'error': 'Not found',
    'status': 404
  } ) );

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.app = app;
  globalThis.mf.usageStats = usageStats;
} )();
