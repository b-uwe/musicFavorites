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
      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      // Run one cycle with 100ms total duration
      await cacheUpdater.start( {
        'cycleIntervalMs': 100,
        'maxCycles': 1
      } );

      // Verify all acts were updated
      expect( database.getAllActIds ).toHaveBeenCalledTimes( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actIds[ 0 ] );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actIds[ 1 ] );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 2 );
    }, 10000 );

    /**
     * Test that start() runs multiple cycles
     */
    test( 'runs multiple cycles sequentially', async () => {
      const actIds = [ transformedTheKinks._id ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Run 3 cycles with 50ms each
      await cacheUpdater.start( {
        'cycleIntervalMs': 50,
        'maxCycles': 3
      } );

      // Verify 3 cycles ran
      expect( database.getAllActIds ).toHaveBeenCalledTimes( 3 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 3 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 3 );
    }, 10000 );

    /**
     * Test that start() waits when cache is empty
     */
    test( 'waits when cache is empty and retries', async () => {
      // First call: empty cache, second call: has acts
      database.getAllActIds.mockResolvedValueOnce( [] );
      database.getAllActIds.mockResolvedValueOnce( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Run 2 cycles with 50ms interval
      await cacheUpdater.start( {
        'cycleIntervalMs': 50,
        'maxCycles': 2
      } );

      // Verify: first cycle found empty cache, second cycle processed act
      expect( database.getAllActIds ).toHaveBeenCalledTimes( 2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );
    }, 10000 );

    /**
     * Test that start() retries after errors
     */
    test( 'retries after getAllActIds error', async () => {
      // First call fails, second call succeeds
      database.getAllActIds.mockRejectedValueOnce( new Error( 'Database error' ) );
      database.getAllActIds.mockResolvedValueOnce( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Run 2 cycles with 100ms interval and 20ms retry delay
      await cacheUpdater.start( {
        'cycleIntervalMs': 100,
        'retryDelayMs': 20,
        'maxCycles': 2
      } );

      // Verify: first cycle failed and retried, second cycle succeeded
      expect( database.getAllActIds ).toHaveBeenCalledTimes( 2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );
    }, 10000 );

    /**
     * Test that start() respects custom cycle interval
     */
    test( 'divides cycle interval evenly among acts', async () => {
      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const startTime = Date.now();

      // Run 1 cycle with 200ms total (100ms per act with 2 acts)
      await cacheUpdater.start( {
        'cycleIntervalMs': 200,
        'maxCycles': 1
      } );

      const duration = Date.now() - startTime;

      // Verify timing: should take at least 200ms (2 acts * 100ms each)
      expect( duration ).toBeGreaterThanOrEqual( 190 ); // Allow 10ms margin
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 2 );
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
      const startPromise = cacheUpdater.start( {
        'cycleIntervalMs': undefined,
        'maxCycles': 1
      } );

      // Fast-forward through all timers (24-hour sleep becomes instant)
      await jest.runAllTimersAsync();
      await startPromise;

      expect( database.getAllActIds ).toHaveBeenCalledTimes( 1 );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that start() uses default for maxCycles when undefined
     */
    test( 'uses default maxCycles (Infinity) when explicitly undefined', async () => {
      jest.useFakeTimers();

      database.getAllActIds.mockResolvedValue( [] );

      // Pass undefined for maxCycles to test the ?? Infinity branch
      // This will default to Infinity, but we'll only run for a short time
      const startPromise = cacheUpdater.start( {
        'cycleIntervalMs': 50,
        'retryDelayMs': 1,
        'maxCycles': undefined
      } );

      // Advance timers for just 1 cycle to verify it started
      await jest.advanceTimersByTimeAsync( 60 );

      // Verify it ran at least once (would continue forever with Infinity)
      expect( database.getAllActIds ).toHaveBeenCalled();

      // Clean up - restore real timers (the infinite loop continues in background)
      jest.useRealTimers();
    }, 10000 );

  } );
} );
