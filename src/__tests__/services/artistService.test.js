/**
 * Tests for artist service with transparent caching
 * @module __tests__/services/artistService
 */

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );
jest.mock( '../../services/cacheUpdater' );

const artistService = require( '../../services/artistService' );
const cacheUpdater = require( '../../services/cacheUpdater' );
const database = require( '../../services/database' );
const fixtureModifier = require( '../../testHelpers/fixtureModifier' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

const { determineStatus } = artistService;

describe( 'Artist Service', () => {
  let transformedJungleRot;
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();

    // Reset database mocks to default behavior
    database.testCacheHealth.mockResolvedValue();
    database.cacheArtist.mockResolvedValue();

    transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );

    // Default mock for processFetchQueue to return resolved promise
    cacheUpdater.processFetchQueue.mockResolvedValue();
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

  describe( 'getMultipleArtistsFromCache - cache health checking', () => {
    /**
     * Test that cache health is checked and recovers when it passes
     */
    test( 'tests cache health after flagging unhealthy and recovers', async () => {
      const id1 = transformedJungleRot._id;

      // First, cause cache to be flagged unhealthy by failing a cache write
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureJungleRot );
      database.cacheArtist.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

      const firstResult = await artistService.getMultipleArtistsFromCache( [ id1 ] );

      expect( firstResult ).toHaveLength( 1 );

      // Wait for cache write failure to be handled
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Second call - cache health should be tested since it was flagged unhealthy
      // Make health check pass this time
      database.testCacheHealth.mockResolvedValueOnce();
      database.getArtistFromCache.mockResolvedValueOnce( {
        'musicbrainzId': id1,
        'name': transformedJungleRot.name
      } );

      const secondResult = await artistService.getMultipleArtistsFromCache( [ id1 ] );

      expect( database.testCacheHealth ).toHaveBeenCalledTimes( 1 );
      expect( secondResult ).toHaveLength( 1 );
    } );

    /**
     * Test circuit breaker: cache health check fails and throws error
     */
    test( 'throws error when cache health check fails', async () => {
      const id1 = transformedJungleRot._id;

      // First, cause cache to be flagged unhealthy by failing a cache write
      database.getArtistFromCache.mockResolvedValueOnce( null );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureJungleRot );
      database.cacheArtist.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

      const firstResult = await artistService.getMultipleArtistsFromCache( [ id1 ] );

      expect( firstResult ).toHaveLength( 1 );

      // Wait for cache write failure to be handled
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Second call - cache health check should fail
      database.testCacheHealth.mockRejectedValueOnce( new Error( 'Health check failed' ) );

      await expect( artistService.getMultipleArtistsFromCache( [ id1 ] ) ).
        rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );
      expect( database.testCacheHealth ).toHaveBeenCalledTimes( 1 );
      expect( database.getArtistFromCache ).not.toHaveBeenCalledTimes( 2 );
    } );

  } );

  describe( 'getMultipleArtistsFromCache - event-based status determination', () => {
    /**
     * Test that status is determined based on events when fetching missing artist with Bandsintown events
     */
    test( 'determines "on tour" status for missing artist with upcoming events within 90 days', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedVulvodynia._id;
      const eventsIn30Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 30 );

      // First artist is cached
      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name,
          'status': 'active'
        } ).
        mockResolvedValueOnce( null );

      // Second artist is missing - fetch from API with events
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn30Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ].musicbrainzId ).toBe( id1 );
      expect( result[ 1 ].musicbrainzId ).toBe( id2 );
      expect( result[ 1 ].status ).toBe( 'on tour' );
      expect( result[ 1 ].events ).toBeDefined();
      expect( result[ 1 ].events.length ).toBeGreaterThan( 0 );
    } );

    /**
     * Test that status is "tour planned" for events between 91-270 days
     */
    test( 'determines "tour planned" status for missing artist with events between 91-270 days', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedVulvodynia._id;
      const eventsIn120Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 120 );

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name,
          'status': 'active'
        } ).
        mockResolvedValueOnce( null );

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn120Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 1 ].status ).toBe( 'tour planned' );
    } );

    /**
     * Test that MusicBrainz status is preserved when no events
     */
    test( 'preserves MusicBrainz status for missing artist with no Bandsintown events', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name,
          'status': 'active'
        } ).
        mockResolvedValueOnce( null );

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 1 ].musicbrainzId ).toBe( id2 );
      expect( result[ 1 ].status ).toBe( 'disbanded' );
      expect( result[ 1 ].events ).toEqual( [] );
    } );

    /**
     * Test that MusicBrainz status is preserved when events are beyond 270 days
     */
    test( 'preserves MusicBrainz status for missing artist with events beyond 270 days', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedVulvodynia._id;
      const eventsIn300Days = fixtureModifier.normalizeDates( fixtureBandsintownVulvodynia, 300 );

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name,
          'status': 'active'
        } ).
        mockResolvedValueOnce( null );

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( eventsIn300Days );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 1 ].status ).toBe( 'active' );
    } );
  } );

  describe( 'getMultipleArtistsFromCache - basic functionality', () => {
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
     * Test immediate fetch when exactly one artist is missing from cache
     */
    test( 'fetches immediately when exactly one artist is missing from cache', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name
        } ).
        mockResolvedValueOnce( null );

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ].musicbrainzId ).toBe( id1 );
      expect( result[ 1 ].musicbrainzId ).toBe( id2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( id2 );
    } );

    /**
     * Test silent cache failure when exactly one artist is missing
     */
    test( 'returns data even when cache write fails for ONE missing artist', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.
        mockResolvedValueOnce( {
          'musicbrainzId': id1,
          'name': transformedJungleRot.name
        } ).
        mockResolvedValueOnce( null );

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      const result = await artistService.getMultipleArtistsFromCache( [ id1, id2 ] );

      // Should still return the data even though caching failed
      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ].musicbrainzId ).toBe( id1 );
      expect( result[ 1 ].musicbrainzId ).toBe( id2 );

      // Wait a bit for the promise to settle
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );
    } );

    /**
     * Test error when all artists are missing from cache
     */
    test( 'throws error when all artists are missing from cache', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      database.getArtistFromCache.mockResolvedValue( null );

      await expect( artistService.getMultipleArtistsFromCache( [ id1, id2 ] ) ).
        rejects.toThrow( '2 acts not found in cache! Updating in the background! Please retry in a few minutes' );
    } );

    /**
     * Test that background fetch is triggered for 2+ missing IDs
     */
    test( 'triggers background fetch for 2+ missing IDs', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;
      const id3 = transformedVulvodynia._id;

      database.getArtistFromCache.mockResolvedValue( null );

      const promise = artistService.getMultipleArtistsFromCache( [ id1, id2, id3 ] );

      // Promise should reject immediately with error for 3 missing acts
      await expect( promise ).rejects.toThrow( '3 acts not found in cache! Updating in the background! Please retry in a few minutes' );
    } );
  } );

  describe( 'triggerBackgroundSequentialFetch - promise handling', () => {
    /**
     * Test success case - processFetchQueue resolves
     */
    test( 'handles successful queue processing', async () => {
      const id1 = transformedJungleRot._id;

      // Mock processFetchQueue to resolve successfully
      cacheUpdater.processFetchQueue.mockResolvedValue();

      // Trigger background fetch
      artistService.triggerBackgroundSequentialFetch( [ id1 ] );

      // Wait for promise to resolve
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Verify processFetchQueue was called
      expect( cacheUpdater.processFetchQueue ).toHaveBeenCalled();
    } );

    /**
     * Test error case - processFetchQueue rejects
     */
    test( 'handles queue processing errors gracefully', async () => {
      const id1 = transformedJungleRot._id;
      const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation();

      // Mock processFetchQueue to reject
      cacheUpdater.processFetchQueue.mockRejectedValue( new Error( 'Queue failed' ) );

      // Trigger background fetch
      artistService.triggerBackgroundSequentialFetch( [ id1 ] );

      // Wait for promise to reject and error to be logged
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Verify error was logged
      expect( consoleSpy ).toHaveBeenCalledWith( 'Background fetch error:', 'Queue failed' );

      consoleSpy.mockRestore();
    } );

    /**
     * Test early return when processor is already running
     */
    test( 'returns immediately when processor is already running', async () => {
      const id1 = transformedJungleRot._id;
      const id2 = transformedTheKinks._id;

      // Mock processFetchQueue to never resolve (simulates long-running process)
      cacheUpdater.processFetchQueue.mockImplementation( () => new Promise( () => {} ) );

      // First call starts the processor
      artistService.triggerBackgroundSequentialFetch( [ id1 ] );

      // Second call should return immediately without starting another processor
      artistService.triggerBackgroundSequentialFetch( [ id2 ] );

      // Wait a bit
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );

      // Verify processFetchQueue was only called once
      expect( cacheUpdater.processFetchQueue ).toHaveBeenCalledTimes( 1 );
    } );
  } );

} );
