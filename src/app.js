/**
 * Express application configuration
 * @module app
 */

const express = require( 'express' );
const path = require( 'path' );
const artistService = require( './services/artistService' );

const app = express();

/**
 * Get information about one or more music acts
 * Supports comma-separated MusicBrainz IDs for multiple acts
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Acts information with attribution and metadata
 */
app.get( '/acts/:id', async ( req, res ) => {
  const { id } = req.params;

  // Enable pretty-printing if ?pretty query parameter is present
  if ( 'pretty' in req.query ) {
    app.set( 'json spaces', 2 );
  } else {
    app.set( 'json spaces', 0 );
  }

  // TODO: Remove robots blocking once caching layer is in place to protect upstream providers
  res.set( 'X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet' );

  /*
   * TODO: Implement proper caching strategy with ETags and Cache-Control max-age
   * For now, disable all caching
   */
  res.set( 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate' );
  res.set( 'Pragma', 'no-cache' );
  res.set( 'Expires', '0' );

  try {
    // Split comma-separated IDs
    const artistIds = id.split( ',' ).map( ( artistId ) => artistId.trim() );

    // Use fetchMultipleActs for smart caching
    const result = await artistService.fetchMultipleActs( artistIds );

    // Check if result contains an error
    if ( result.error ) {
      return res.status( 503 ).json( {
        'meta': {
          'attribution': {
            'sources': [ 'MusicBrainz', 'Bandsintown', 'Songkick' ],
            'notice': 'Data from third-party sources subject to their respective terms.\n' +
              'See https://github.com/b-uwe/musicFavorites/blob/main/DATA_NOTICE.md for details.'
          },
          'license': 'AGPL-3.0',
          'repository': 'https://github.com/b-uwe/musicFavorites'
        },
        'type': 'error',
        'error': result.error
      } );
    }

    // Success - return acts
    return res.json( {
      'meta': {
        'attribution': {
          'sources': [ 'MusicBrainz', 'Bandsintown', 'Songkick' ],
          'notice': 'Data from third-party sources subject to their respective terms.\n' +
            'See https://github.com/b-uwe/musicFavorites/blob/main/DATA_NOTICE.md for details.'
        },
        'license': 'AGPL-3.0',
        'repository': 'https://github.com/b-uwe/musicFavorites'
      },
      'type': 'acts',
      'acts': result.acts
    } );
  } catch ( error ) {
    return res.status( 500 ).json( {
      'type': 'error',
      'error': {
        'message': 'Failed to fetch artist data',
        'details': error.message
      }
    } );
  }
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
 * Handle 404 errors with JSON response
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} JSON error response
 */
app.use( ( req, res ) => res.status( 404 ).json( {
  'error': 'Not found',
  'status': 404
} ) );

module.exports = app;
