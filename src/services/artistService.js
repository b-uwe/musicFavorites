/**
 * Artist service with transparent caching
 * @module services/artistService
 */

const database = require( './database' );
const musicbrainzClient = require( './musicbrainz' );
const musicbrainzTransformer = require( './musicbrainzTransformer' );

let cacheHealthy = true;

/**
 * Gets artist data with transparent caching
 * Checks cache first, falls back to MusicBrainz API if not found
 * Caches API results asynchronously (fire-and-forget)
 * Protects upstream services by failing fast when cache is unhealthy
 * @param {string} artistId - The MusicBrainz artist ID
 * @returns {Promise<object>} Artist data (from cache or API)
 * @throws {Error} When cache is unhealthy or unavailable
 */
const getArtist = async ( artistId ) => {
  // If cache was flagged unhealthy, test it before proceeding
  if ( !cacheHealthy ) {
    try {
      await database.testCacheHealth();
      cacheHealthy = true;
    } catch ( error ) {
      throw new Error( 'Cache unavailable - service degraded' );
    }
  }

  // Try to get from cache first
  const cachedArtist = await database.getArtistFromCache( artistId );

  if ( cachedArtist ) {
    return cachedArtist;
  }

  // Cache miss - fetch from MusicBrainz API
  const mbData = await musicbrainzClient.fetchArtist( artistId );
  const transformedData = musicbrainzTransformer.transformArtistData( mbData );

  // Cache asynchronously (fire-and-forget) - don't wait for it
  database.cacheArtist( transformedData ).catch( () => {
    cacheHealthy = false;
  } );

  return transformedData;
};

module.exports = {
  getArtist
};
