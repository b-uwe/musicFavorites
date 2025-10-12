/**
 * Express application configuration
 * @module app
 */

const express = require( 'express' );
const musicbrainzClient = require( './services/musicbrainz' );
const musicbrainzTransformer = require( './services/musicbrainzTransformer' );

const app = express();

/**
 * Get information about a music act
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} Act information with attribution and metadata
 */
app.get( '/act/:id', async ( req, res ) => {
  const { id } = req.params;

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
    const mbData = await musicbrainzClient.fetchArtist( id );
    const actData = musicbrainzTransformer.transformArtistData( mbData );

    return res.json( {
      'type': 'act',
      'act': actData,
      'meta': {
        'attribution': {
          'sources': [ 'MusicBrainz', 'Bandsintown', 'Songkick' ],
          'notice': 'Data from third-party sources subject to their respective terms.\n' +
            'See https://github.com/b-uwe/musicFavorites/blob/main/DATA_NOTICE.md for details.'
        },
        'license': 'AGPL-3.0',
        'repository': 'https://github.com/b-uwe/musicFavorites'
      }
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

module.exports = app;
