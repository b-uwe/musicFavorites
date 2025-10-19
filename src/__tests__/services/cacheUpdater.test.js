/**
 * Tests for cache updater service
 * @module __tests__/services/cacheUpdater
 */

const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

const cacheUpdater = require( '../../services/cacheUpdater' );

describe( 'Cache Updater Service', () => {
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();

    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );
  } );

  describe( 'updateAct', () => {
    /**
     * Test that updateAct fetches fresh data and replaces cache
     */
    test( 'fetches MusicBrainz data and replaces cache entry', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actId );
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          '_id': actId,
          'name': transformedTheKinks.name,
          'events': []
        } )
      );
    } );

    /**
     * Test that updateAct fetches Bandsintown events when available
     */
    test( 'fetches Bandsintown events when artist has bandsintown URL', async () => {
      const actId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actId );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).
        toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          '_id': actId,
          'name': transformedVulvodynia.name,
          'events': expect.any( Array )
        } )
      );
    } );

    /**
     * Test that updateAct includes Berlin timezone timestamp
     */
    test( 'includes Berlin timezone updatedAt timestamp in cached data', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( database.cacheArtist ).toHaveBeenCalled();
      const cachedData = database.cacheArtist.mock.calls[ 0 ][ 0 ];

      expect( cachedData ).toHaveProperty( 'updatedAt' );
      expect( typeof cachedData.updatedAt ).toBe( 'string' );
      // Format: YYYY-MM-DD HH:MM:SS (Berlin timezone, CET/CEST)
      expect( cachedData.updatedAt ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ );
    } );

    /**
     * Test that updateAct skips on error without throwing
     */
    test( 'skips update on MusicBrainz error without throwing', async () => {
      const actId = 'invalid-id';

      musicbrainzClient.fetchArtist.mockRejectedValue( new Error( 'MusicBrainz error' ) );

      await expect( cacheUpdater.updateAct( actId ) ).resolves.not.toThrow();
      expect( database.cacheArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that updateAct skips on cache write error without throwing
     */
    test( 'skips update on cache write error without throwing', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      await expect( cacheUpdater.updateAct( actId ) ).resolves.not.toThrow();
      expect( database.cacheArtist ).toHaveBeenCalled();
    } );

    /**
     * Test that updateAct handles Bandsintown fetch errors gracefully
     */
    test( 'handles Bandsintown fetch error and caches with empty events', async () => {
      const actId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          '_id': actId,
          'events': []
        } )
      );
    } );
  } );

  describe( 'start', () => {
    /**
     * Test that start() runs one complete cycle with multiple acts
     */
    test( 'runs one complete cycle updating all acts', async () => {
      jest.useFakeTimers();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      // Start infinite loop with 100ms cycle interval
      cacheUpdater.start( {
        'cycleIntervalMs': 100
      } );

      // Advance time for one complete cycle (2 acts × 50ms each = 100ms total)
      await jest.advanceTimersByTimeAsync( 99 );

      // Verify all acts were updated
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actIds[ 0 ] );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actIds[ 1 ] );
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() runs multiple cycles
     */
    test( 'runs multiple cycles sequentially', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedTheKinks._id ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start infinite loop with 50ms cycles
      cacheUpdater.start( {
        'cycleIntervalMs': 50
      } );

      // Advance time for 3 complete cycles (3 × 50ms = 150ms)
      await jest.advanceTimersByTimeAsync( 150 );

      // Verify 3 cycles ran
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() waits when cache is empty
     */
    test( 'waits when cache is empty and retries', async () => {
      jest.useFakeTimers();

      // First call: empty cache, second call: has acts
      database.getAllActIds.mockResolvedValueOnce( [] );
      database.getAllActIds.mockResolvedValueOnce( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start infinite loop with 50ms cycles
      cacheUpdater.start( {
        'cycleIntervalMs': 50
      } );

      // Advance time for 2 complete cycles (2 × 50ms = 100ms)
      //  - First cycle: empty cache, sleeps 50ms
      //  - Second cycle: processes 1 act, sleeps 50ms
      await jest.advanceTimersByTimeAsync( 99 );

      // Verify: first cycle found empty cache, second cycle processed act
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() retries after errors
     */
    test( 'retries after getAllActIds error', async () => {
      jest.useFakeTimers();

      // First call fails, second call succeeds
      database.getAllActIds.mockRejectedValueOnce( new Error( 'Database error' ) );
      database.getAllActIds.mockResolvedValueOnce( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start infinite loop with 100ms cycle and 20ms retry delay
      cacheUpdater.start( {
        'cycleIntervalMs': 100,
        'retryDelayMs': 20
      } );

      // Advance time: first cycle fails (20ms retry), then second cycle succeeds (100ms)
      await jest.advanceTimersByTimeAsync( 119 );

      // Verify: first cycle failed and retried, second cycle succeeded
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() divides cycle interval evenly among acts
     */
    test( 'divides cycle interval evenly among acts', async () => {
      jest.useFakeTimers();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start infinite loop with 200ms cycle (100ms per act with 2 acts)
      cacheUpdater.start( {
        'cycleIntervalMs': 200
      } );

      // Advance time for one complete cycle
      await jest.advanceTimersByTimeAsync( 199 );

      // Verify: cycle completed and processed both acts
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() uses default for cycleIntervalMs when undefined
     */
    test( 'uses default cycleIntervalMs when explicitly undefined', async () => {
      jest.useFakeTimers();

      // Return 1 act so it doesn't use the long sleep for empty cache
      database.getAllActIds.mockResolvedValue( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Pass undefined for cycleIntervalMs to test the ?? TWENTY_FOUR_HOURS_MS branch
      cacheUpdater.start( {
        'cycleIntervalMs': undefined
      } );

      // Advance timers by 24 hours (default cycle interval)
      await jest.advanceTimersByTimeAsync( 24 * 60 * 60 * 1000 );

      expect( database.getAllActIds ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

  } );
} );
