/**
 * Tests for artist service with transparent caching
 * @module __tests__/services/artistService
 */

const artistService = require( '../../services/artistService' );
const database = require( '../../services/database' );
const fixtureModifier = require( '../../testHelpers/fixtureModifier' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

const { determineStatus } = artistService;

describe( 'Artist Service', () => {
  let transformedJungleRot;
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );
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
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          ...transformedTheKinks,
          events: []
        } )
      );

      // Result should have musicbrainzId (API format), not _id
      expect( result.musicbrainzId ).toBe( transformedTheKinks._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedTheKinks.name );
    } );

    /**
     * Test that caching happens asynchronously (fire-and-forget)
     */
    test( 'returns data immediately without waiting for cache operation', async () => {
      const artistId = transformedVulvodynia._id;
      let cacheResolved = false;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
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
      expect( result.musicbrainzId ).toBe( transformedVulvodynia._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedVulvodynia.name );
      expect( cacheResolved ).toBe( false );
      expect( database.cacheArtist ).toHaveBeenCalled();
    } );

    /**
     * Test that cache errors don't affect the response
     */
    test( 'returns data even if caching fails', async () => {
      const artistId = transformedVulvodynia._id;
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      const result = await artistService.getArtist( artistId );

      // Result should have musicbrainzId (API format), not _id
      expect( result.musicbrainzId ).toBe( transformedVulvodynia._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedVulvodynia.name );
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
      const artistId = transformedVulvodynia._id;
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
      const artistId = transformedVulvodynia._id;

      // First call - cache miss
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValueOnce( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValueOnce();

      const firstResult = await artistService.getArtist( artistId );

      // First result should have musicbrainzId (API format), not _id
      expect( firstResult.musicbrainzId ).toBe( transformedVulvodynia._id );
      expect( firstResult._id ).toBeUndefined();
      expect( firstResult.name ).toBe( transformedVulvodynia.name );
      expect( database.getArtistFromCache ).toHaveBeenCalledTimes( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );

      // Second call - cache hit (getArtistFromCache already returns musicbrainzId format)
      const cachedData = {
        'musicbrainzId': transformedVulvodynia._id,
        'name': transformedVulvodynia.name,
        'country': transformedVulvodynia.country,
        'region': transformedVulvodynia.region,
        'disambiguation': transformedVulvodynia.disambiguation,
        'status': transformedVulvodynia.status,
        'relations': transformedVulvodynia.relations
      };
      database.getArtistFromCache.mockResolvedValueOnce( cachedData );

      const secondResult = await artistService.getArtist( artistId );

      // Second result should also have musicbrainzId (API format)
      expect( secondResult.musicbrainzId ).toBe( transformedVulvodynia._id );
      expect( secondResult._id ).toBeUndefined();
      expect( secondResult.name ).toBe( transformedVulvodynia.name );
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
      const artistId = transformedVulvodynia._id;

      // First call - cache miss with write failure
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValueOnce( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

      // Wait for promise rejection to be handled
      const firstResult = await artistService.getArtist( artistId );

      // First result should have musicbrainzId (API format), not _id
      expect( firstResult.musicbrainzId ).toBe( transformedVulvodynia._id );
      expect( firstResult._id ).toBeUndefined();
      expect( firstResult.name ).toBe( transformedVulvodynia.name );

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
      const artistId = transformedVulvodynia._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).
        toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
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
     * Test that empty events array is returned when Bandsintown returns no events
     */
    test( 'returns empty events array when Bandsintown returns no events', async () => {
      const artistId = transformedVulvodynia._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( result ).toHaveProperty( 'events' );
      expect( result.events ).toEqual( [] );
    } );

    /**
     * Test that Bandsintown fetch errors cause getArtist to fail
     */
    test( 'throws error when Bandsintown fetch fails', async () => {
      const artistId = transformedVulvodynia._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( artistService.getArtist( artistId ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( database.cacheArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that events are cached together with artist data
     */
    test( 'caches events together with artist data', async () => {
      const artistId = transformedVulvodynia._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
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
      const artistId = transformedVulvodynia._id;
      const cachedData = {
        'musicbrainzId': transformedVulvodynia._id,
        'name': transformedVulvodynia.name,
        'country': transformedVulvodynia.country,
        'region': transformedVulvodynia.region,
        'disambiguation': transformedVulvodynia.disambiguation,
        'status': transformedVulvodynia.status,
        'relations': transformedVulvodynia.relations,
        'events': [
          {
            'name': 'Vulvodynia @ O2 Academy Islington',
            'date': '2025-11-25',
            'localTime': '18:00:00',
            'location': {
              'address': 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom',
              'geo': {
                'lat': 51.5343501,
                'lon': -0.1058837
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

  describe( 'getArtist - event-based status determination', () => {
    /**
     * Helper to get UTC date N days from now
     * @param {number} daysFromNow - Number of days from today
     * @returns {string} ISO date string in YYYY-MM-DD format
     */
    const getDateDaysFromNow = ( daysFromNow ) => {
      const date = new Date();

      date.setUTCHours( 0, 0, 0, 0 );
      date.setUTCDate( date.getUTCDate() + daysFromNow );

      return date.toISOString().split( 'T' )[ 0 ];
    };

    /**
     * Test "On tour" status when events exist within 3 months (90 days)
     */
    test( 'returns "On tour" when events exist within 90 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsIn30Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 30 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn30Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'on tour' );
    } );

    /**
     * Test "Tour planned" status when events exist between 91-270 days
     */
    test( 'returns "Tour planned" when events exist between 91-270 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsIn120Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 120 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn120Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'tour planned' );
    } );

    /**
     * Test MusicBrainz status preserved when events are beyond 270 days
     */
    test( 'returns MusicBrainz status when events are beyond 270 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsIn300Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 300 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn300Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'active' );
    } );

    /**
     * Test MusicBrainz status preserved when no events exist
     */
    test( 'returns MusicBrainz status when no events exist', async () => {
      const artistId = transformedTheKinks._id;

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'disbanded' );
    } );

    /**
     * Test boundary: 90 days is "On tour"
     */
    test( 'returns "On tour" for event at exactly 90 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsAt90Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 90 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsAt90Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'on tour' );
    } );

    /**
     * Test boundary: 91 days is "Tour planned"
     */
    test( 'returns "Tour planned" for event at exactly 91 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsAt91Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 91 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsAt91Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'tour planned' );
    } );

    /**
     * Test boundary: 270 days is "Tour planned"
     */
    test( 'returns "Tour planned" for event at exactly 270 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsAt270Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 270 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsAt270Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'tour planned' );
    } );

    /**
     * Test boundary: 271 days returns MusicBrainz status
     */
    test( 'returns MusicBrainz status for event at exactly 271 days', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsAt271Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 271 );

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsAt271Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'active' );
    } );

    /**
     * Test handling of events with all invalid dates
     */
    test( 'returns MusicBrainz status when all events have invalid dates', async () => {
      const artistId = transformedVulvodynia._id;
      const eventsWithInvalidDates = [
        fixtureModifier.modifyArrayItem( fixtureBandsintownVulvodynia, 0, {
          'startDate': 'invalid-date-format'
        } )[ 0 ],
        fixtureModifier.modifyArrayItem( fixtureBandsintownVulvodynia, 1, {
          'startDate': undefined
        } )[ 1 ]
      ];

      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsWithInvalidDates );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getArtist( artistId );

      expect( result.status ).toBe( 'active' );
    } );
  } );

  describe( 'determineStatus - unit tests', () => {
    /**
     * Test line 53: all events have invalid dates in transformed format
     */
    test( 'returns MusicBrainz status when all transformed events have invalid dates', () => {
      const eventsWithInvalidDates = [
        {
          'name': 'Event with invalid date',
          'date': 'not-a-valid-date',
          'location': {}
        },
        {
          'name': 'Event with missing date',
          'location': {}
        }
      ];

      const result = determineStatus( eventsWithInvalidDates, 'active' );

      expect( result ).toBe( 'active' );
    } );
  } );

  describe( 'fetchBandintownEvents - unit tests', () => {
    /**
     * Test that silentFail undefined uses default (false) and throws error
     */
    test( 'throws error when Bandsintown fetch fails and silentFail is undefined', async () => {
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( artistService.fetchBandsintownEvents( transformedVulvodynia ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );

    /**
     * Test that silentFail set to true fails silently
     */
    test( 'does NOT throw when Bandsintown fetch fails and silentFail is true', async () => {
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await artistService.fetchBandsintownEvents( transformedVulvodynia, true );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'fetchAndEnrichArtistData - direct tests', () => {
    /**
     * Test that silentEventFail=true returns empty events on Bandsintown error
     */
    test( 'returns empty events when Bandsintown fetch fails and silentEventFail=true', async () => {
      const artistId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await artistService.fetchAndEnrichArtistData( artistId, true );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( result ).toHaveProperty( 'events' );
      expect( result.events ).toEqual( [] );
      expect( result ).toHaveProperty( 'updatedAt' );
      expect( result ).toHaveProperty( 'status' );
    } );

    /**
     * Test that silentEventFail undefined uses default (false) and throws error
     */
    test( 'throws error when Bandsintown fetch fails and silentEventFail=undefined', async () => {
      const artistId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( artistService.fetchAndEnrichArtistData( artistId ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );
  } );

  describe( 'getMultipleArtistsFromCache', () => {
    /**
     * Test successful retrieval of multiple cached artists
     */
    test( 'returns array of artists when all are cached', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name
        } ).
        mockResolvedValueOnce( {
          'musicbrainzId': id2,
          'name': transformedTheKinks.name
        } );

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ].musicbrainzId ).toBe( id1 );
      expect( result[ 1 ].musicbrainzId ).toBe( id2 );
      expect( database.getArtistFromCache ).toHaveBeenCalledTimes( 2 );
    } );

    /**
     * Test error when one artist is missing from cache
     */
    test( 'throws error when one artist is missing from cache', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name
        } ).
        mockResolvedValueOnce( null );

      await expect( artistService.getMultipleArtistsFromCache( [ id1, id2 ] ) ).
        rejects.toThrow( `Missing from cache: ${id2}` );
    } );

    /**
     * Test error when all artists are missing from cache
     */
    test( 'throws error when all artists are missing from cache', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.mockResolvedValue( null );

      await expect( artistService.getMultipleArtistsFromCache( [ id1, id2 ] ) ).
        rejects.toThrow( `Missing from cache: ${id1}, ${id2}` );
    } );

    /**
     * Test that background fetch is triggered but doesn't block response
     */
    test( 'triggers background fetch for missing IDs without blocking', async () => {
      const id1 = transformedJungleRot._id;

      database.getArtistFromCache.mockResolvedValue( null );

      const promise = artistService.getMultipleArtistsFromCache( [ id1 ] );

      // Promise should reject immediately without waiting for background fetch
      await expect( promise ).rejects.toThrow( `Missing from cache: ${id1}` );

      // Give background process a moment to start
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );
    } );
  } );

} );
