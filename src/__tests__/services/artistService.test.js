/**
 * Tests for artist service with transparent caching
 * @module __tests__/services/artistService
 */

const artistService = require( '../../services/artistService' );
const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/ldjson/bandsintown-artist-6461184.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

describe( 'Artist Service', () => {
  let transformedJungleRot;
  let transformedTheKinks;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
  } );

  describe( 'getArtist - cache hit', () => {
    /**
     * Test cache hit scenario - returns cached data without calling API
     */
    test( 'returns cached artist data when found in cache', async () => {
      const artistId = transformedJungleRot._id;
      // GetArtistFromCache returns data with musicbrainzId (API format)
      const cachedData = {
        'musicbrainzId': transformedJungleRot._id,
        'name': transformedJungleRot.name,
        'country': transformedJungleRot.country,
        'region': transformedJungleRot.region,
        'disambiguation': transformedJungleRot.disambiguation,
        'status': transformedJungleRot.status,
        'relations': transformedJungleRot.relations
      };
      database.getArtistFromCache.mockResolvedValue( cachedData );

      const result = await artistService.getArtist( artistId );

      expect( database.getArtistFromCache ).toHaveBeenCalledWith( artistId );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
      expect( database.cacheArtist ).not.toHaveBeenCalled();
      expect( result ).toEqual( cachedData );
    } );
  } );

  describe( 'getArtist - cache miss', () => {
    /**
     * Test cache miss scenario - fetches from API, caches, and returns data
     */
    test( 'fetches from API and caches when not in cache', async () => {
      const artistId = transformedTheKinks._id;
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( database.getArtistFromCache ).toHaveBeenCalledWith( artistId );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( artistId );
      expect( database.cacheArtist ).toHaveBeenCalledWith( {
        ...transformedTheKinks,
        'events': []
      } );

      // Result should have musicbrainzId (API format), not _id
      expect( result.musicbrainzId ).toBe( transformedTheKinks._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedTheKinks.name );
    } );

    /**
     * Test that caching happens asynchronously (fire-and-forget)
     */
    test( 'returns data immediately without waiting for cache operation', async () => {
      const artistId = transformedJungleRot._id;
      let cacheResolved = false;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureJungleRot );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureVulvodynia );
      database.cacheArtist.mockImplementation( async () => {
        await new Promise( ( resolve ) => {
          setTimeout( () => {
            cacheResolved = true;
            resolve();
          }, 100 );
        } );
      } );

      const result = await artistService.getArtist( artistId );

      // Result should have musicbrainzId (API format), not _id
      expect( result.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedJungleRot.name );
      expect( cacheResolved ).toBe( false );
      expect( database.cacheArtist ).toHaveBeenCalled();
    } );

    /**
     * Test that cache errors don't affect the response
     */
    test( 'returns data even if caching fails', async () => {
      const artistId = transformedJungleRot._id;
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureJungleRot );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureVulvodynia );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      const result = await artistService.getArtist( artistId );

      // Result should have musicbrainzId (API format), not _id
      expect( result.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedJungleRot.name );
      expect( database.cacheArtist ).toHaveBeenCalled();
    } );
  } );

  describe( 'getArtist - error handling', () => {
    /**
     * Test API error propagation
     */
    test( 'throws error when API fetch fails', async () => {
      const artistId = 'invalid-id';
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockRejectedValue( new Error( 'MusicBrainz: API error' ) );

      await expect( artistService.getArtist( artistId ) ).rejects.toThrow( 'MusicBrainz: API error' );
      expect( database.cacheArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test database error propagation - fail fast to avoid hammering upstream
     */
    test( 'throws error when DB is down without calling MusicBrainz API', async () => {
      const artistId = transformedJungleRot._id;
      database.getArtistFromCache.mockRejectedValue( new Error( 'Database connection lost' ) );

      await expect( artistService.getArtist( artistId ) ).rejects.toThrow( 'Database connection lost' );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
      expect( database.cacheArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that we fail fast on DB errors to protect upstream services
     */
    test( 'does not fall back to API when cache lookup fails', async () => {
      const artistId = transformedTheKinks._id;
      database.getArtistFromCache.mockRejectedValue( new Error( 'MongoDB timeout' ) );

      await expect( artistService.getArtist( artistId ) ).rejects.toThrow( 'MongoDB timeout' );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'getArtist - cache-first behavior integration', () => {
    /**
     * Test the scenario you mentioned: first call misses cache, second call hits cache
     */
    test( 'first call fetches from API, second call returns from cache', async () => {
      const artistId = transformedJungleRot._id;

      // First call - cache miss
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureJungleRot );
      database.cacheArtist.mockResolvedValueOnce();

      const firstResult = await artistService.getArtist( artistId );

      // First result should have musicbrainzId (API format), not _id
      expect( firstResult.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( firstResult._id ).toBeUndefined();
      expect( firstResult.name ).toBe( transformedJungleRot.name );
      expect( database.getArtistFromCache ).toHaveBeenCalledTimes( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );

      // Second call - cache hit (getArtistFromCache already returns musicbrainzId format)
      const cachedData = {
        'musicbrainzId': transformedJungleRot._id,
        'name': transformedJungleRot.name,
        'country': transformedJungleRot.country,
        'region': transformedJungleRot.region,
        'disambiguation': transformedJungleRot.disambiguation,
        'status': transformedJungleRot.status,
        'relations': transformedJungleRot.relations
      };
      database.getArtistFromCache.mockResolvedValueOnce( cachedData );

      const secondResult = await artistService.getArtist( artistId );

      // Second result should also have musicbrainzId (API format)
      expect( secondResult.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( secondResult._id ).toBeUndefined();
      expect( secondResult.name ).toBe( transformedJungleRot.name );
      expect( database.getArtistFromCache ).toHaveBeenCalledTimes( 2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );
    } );
  } );

  describe( 'getArtist - circuit breaker pattern', () => {
    /**
     * Test circuit breaker: after cache write fails, next call tests cache health
     */
    test( 'tests cache health on next call after cache write failure', async () => {
      const artistId = transformedJungleRot._id;

      // First call - cache miss with write failure
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureJungleRot );
      database.cacheArtist.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

      // Wait for promise rejection to be handled
      const firstResult = await artistService.getArtist( artistId );

      // First result should have musicbrainzId (API format), not _id
      expect( firstResult.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( firstResult._id ).toBeUndefined();
      expect( firstResult.name ).toBe( transformedJungleRot.name );

      // Give the catch handler time to run
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Second call - should test cache health before proceeding
      database.testCacheHealth.mockRejectedValueOnce( new Error( 'Health check failed' ) );

      await expect( artistService.getArtist( artistId ) ).
        rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );
      expect( database.testCacheHealth ).toHaveBeenCalledTimes( 1 );
      expect( database.getArtistFromCache ).toHaveBeenCalledTimes( 1 );
    } );
  } );

  describe( 'getArtist - Bandsintown event extraction', () => {
    /**
     * Test that events are fetched and included when artist has Bandsintown URL
     */
    test( 'includes Bandsintown events when artist has bandsintown URL', async () => {
      const artistId = transformedJungleRot._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureJungleRot );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureVulvodynia );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).
        toHaveBeenCalledWith( 'https://www.bandsintown.com/a/13217' );
      expect( result ).toHaveProperty( 'events' );
      expect( Array.isArray( result.events ) ).toBe( true );
      expect( result.events.length ).toBe( 4 );
      expect( result.events[ 0 ] ).toHaveProperty( 'name' );
      expect( result.events[ 0 ] ).toHaveProperty( 'date' );
      expect( result.events[ 0 ] ).toHaveProperty( 'localTime' );
      expect( result.events[ 0 ] ).toHaveProperty( 'location' );
    } );

    /**
     * Test that empty events array is returned when artist has no Bandsintown URL
     */
    test( 'returns empty events when artist has no bandsintown URL', async () => {
      const artistId = transformedTheKinks._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
      expect( result ).toHaveProperty( 'events' );
      expect( result.events ).toEqual( [] );
    } );

    /**
     * Test that events are returned even if Bandsintown fetch fails
     */
    test( 'returns empty events array if Bandsintown fetch fails', async () => {
      const artistId = transformedJungleRot._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureJungleRot );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/13217' );
      expect( result ).toHaveProperty( 'events' );
      expect( result.events ).toEqual( [] );
    } );

    /**
     * Test that events are cached together with artist data
     */
    test( 'caches events together with artist data', async () => {
      const artistId = transformedJungleRot._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureJungleRot );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureVulvodynia );
      database.cacheArtist.mockResolvedValue();

      await artistService.getArtist( artistId );

      // Wait for async cache operation
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      expect( database.cacheArtist ).toHaveBeenCalled();
      const cachedData = database.cacheArtist.mock.calls[ 0 ][ 0 ];

      expect( cachedData ).toHaveProperty( 'events' );
      expect( Array.isArray( cachedData.events ) ).toBe( true );
    } );

    /**
     * Test that cached data includes events
     */
    test( 'returns events from cache when artist is cached', async () => {
      const artistId = transformedJungleRot._id;
      const cachedData = {
        'musicbrainzId': transformedJungleRot._id,
        'name': transformedJungleRot.name,
        'country': transformedJungleRot.country,
        'region': transformedJungleRot.region,
        'disambiguation': transformedJungleRot.disambiguation,
        'status': transformedJungleRot.status,
        'relations': transformedJungleRot.relations,
        'events': [
          {
            'name': 'Cached Event',
            'date': '2025-12-01',
            'localTime': '19:00:00',
            'location': {
              'address': 'Test Address',
              'geo': {
                'lat': 51.5,
                'lon': -0.1
              }
            }
          }
        ]
      };

      database.getArtistFromCache.mockResolvedValue( cachedData );

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
      expect( result.events ).toEqual( cachedData.events );
    } );
  } );
} );
