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
      expect( database.cacheArtist ).toHaveBeenCalledWith( expect.objectContaining( {
        '_id': actId,
        'name': transformedTheKinks.name,
        'events': []
      } ) );
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
      expect( database.cacheArtist ).toHaveBeenCalledWith( expect.objectContaining( {
        '_id': actId,
        'name': transformedVulvodynia.name,
        'events': expect.any( Array )
      } ) );
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
      expect( database.cacheArtist ).toHaveBeenCalledWith( expect.objectContaining( {
        '_id': actId,
        'events': []
      } ) );
    } );
  } );

  describe( 'start', () => {
    /**
     * Test that cycle-based strategy runs one complete cycle with multiple acts
     */
    test( 'runs one complete cycle updating all acts', async () => {
      jest.useFakeTimers();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      // Start dual strategy with 100ms cycle interval
      cacheUpdater.start( {
        'cycleIntervalMs': 100
      } );

      // Phase 1: Sequential bootstrap (2 acts × 30s = 60s)
      await jest.advanceTimersByTimeAsync( 60000 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: Advance time for one complete cycle (2 acts × 50ms each = 100ms total)
      await jest.advanceTimersByTimeAsync( 99 );

      // Verify all acts were updated
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );

    /**
     * Test that cycle-based strategy runs multiple cycles
     */
    test( 'runs multiple cycles sequentially', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedTheKinks._id ];

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start dual strategy with 50ms cycles
      cacheUpdater.start( {
        'cycleIntervalMs': 50
      } );

      // Phase 1: Sequential bootstrap (1 act × 30s = 30s)
      await jest.advanceTimersByTimeAsync( 30000 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: Advance time for 3 complete cycles (3 × 50ms = 150ms)
      await jest.advanceTimersByTimeAsync( 150 );

      // Verify 3 cycles ran
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );

    /**
     * Test that cycle-based strategy waits when cache is empty
     */
    test( 'waits when cache is empty and retries', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      /*
       * Sequential bootstrap: empty cache
       * Cycle-based: first call empty, second call has acts
       */
      database.getAllActsWithMetadata.mockResolvedValueOnce( [] );
      database.getAllActIds.mockResolvedValueOnce( [] );
      database.getAllActIds.mockResolvedValueOnce( [] );
      database.getAllActIds.mockResolvedValueOnce( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start dual strategy with 50ms cycles
      cacheUpdater.start( {
        'cycleIntervalMs': 50
      } );

      // Phase 1: Sequential bootstrap completes immediately (empty cache)
      await jest.advanceTimersByTimeAsync( 1 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      /*
       * Phase 3: Advance time for 2 complete cycles (2 × 50ms = 100ms)
       *  - First cycle: empty cache, sleeps 50ms
       *  - Second cycle: processes 1 act, sleeps 50ms
       */
      await jest.advanceTimersByTimeAsync( 99 );

      // Verify: first cycle found empty cache, second cycle processed act
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );

    /**
     * Test that cycle-based strategy retries after errors
     */
    test( 'retries after getAllActIds error', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      // Sequential bootstrap fails, then cycle-based retries and succeeds
      database.getAllActsWithMetadata.mockRejectedValueOnce( new Error( 'Database error' ) );
      database.getAllActIds.mockRejectedValueOnce( new Error( 'Database error' ) );
      database.getAllActIds.mockResolvedValue( [ transformedTheKinks._id ] );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start dual strategy with 100ms cycle and 20ms retry delay
      cacheUpdater.start( {
        'cycleIntervalMs': 100,
        'retryDelayMs': 20
      } );

      // Phase 1: Sequential bootstrap fails immediately
      await jest.advanceTimersByTimeAsync( 1 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: First cycle fails (20ms retry), then second cycle succeeds (100ms)
      await jest.advanceTimersByTimeAsync( 119 );

      // Verify: cycles failed and retried, eventually succeeded
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );

    /**
     * Test that cycle-based strategy divides cycle interval evenly among acts
     */
    test( 'divides cycle interval evenly among acts', async () => {
      jest.useFakeTimers();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start dual strategy with 200ms cycle (100ms per act with 2 acts)
      cacheUpdater.start( {
        'cycleIntervalMs': 200
      } );

      // Phase 1: Sequential bootstrap (2 acts × 30s = 60s)
      await jest.advanceTimersByTimeAsync( 60000 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: Advance time for one complete cycle
      await jest.advanceTimersByTimeAsync( 199 );

      // Verify: cycle completed and processed both acts
      expect( database.getAllActIds ).toHaveBeenCalled();
      expect( database.cacheArtist ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );

    /**
     * Test that start() uses default for cycleIntervalMs when undefined
     */
    test( 'uses default cycleIntervalMs when explicitly undefined', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      // Return 1 act so it doesn't use the long sleep for empty cache
      database.getAllActIds.mockResolvedValue( [ transformedTheKinks._id ] );
      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Pass undefined for cycleIntervalMs to test the ?? TWENTY_FOUR_HOURS_MS branch
      cacheUpdater.start( {
        'cycleIntervalMs': undefined
      } );

      // Phase 1: Sequential bootstrap (1 act × 30s = 30s)
      await jest.advanceTimersByTimeAsync( 30000 );

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: Advance timers by 24 hours (default cycle interval)
      await jest.advanceTimersByTimeAsync( 24 * 60 * 60 * 1000 );

      expect( database.getAllActIds ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000 );
  } );

  describe( 'runSequentialUpdate', () => {
    /**
     * Test that runSequentialUpdate updates only stale acts (older than 24h)
     */
    test( 'updates only acts with lastUpdated older than 24 hours', async () => {
      jest.useFakeTimers();

      const now = Date.now();
      const freshTimestamp = new Date( now - 12 * 60 * 60 * 1000 ).toISOString();
      const staleTimestamp = new Date( now - 48 * 60 * 60 * 1000 ).toISOString();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': freshTimestamp
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': staleTimestamp
        }
      ];

      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      // Advance time for 1 update (30s)
      await jest.advanceTimersByTimeAsync( 30000 );

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( transformedVulvodynia._id );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 1 );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that runSequentialUpdate includes acts with missing updatedAt
     */
    test( 'updates acts with missing updatedAt field', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id
        }
      ];

      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      await jest.advanceTimersByTimeAsync( 30000 );

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( transformedTheKinks._id );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that runSequentialUpdate skips all acts when all are fresh
     */
    test( 'skips all acts when all are recently updated', async () => {
      const now = Date.now();
      const freshTimestamp = new Date( now - 1 * 60 * 60 * 1000 ).toISOString();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': freshTimestamp
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': freshTimestamp
        }
      ];

      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that runSequentialUpdate updates all acts sequentially with 30s pauses
     */
    test( 'updates all acts sequentially with 30-second pauses', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      // Advance through both updates with 30s pauses
      await jest.advanceTimersByTimeAsync( 60000 );

      const result = await promise;

      expect( result ).toBe( 2 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 2 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that runSequentialUpdate handles empty cache
     */
    test( 'returns 0 when cache is empty', async () => {
      database.getAllActsWithMetadata.mockResolvedValue( [] );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that runSequentialUpdate continues on individual act errors
     */
    test( 'continues processing on individual act errors', async () => {
      jest.useFakeTimers();

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        },
        {
          '_id': 'invalid-id',
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        },
        {
          '_id': transformedVulvodynia._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchArtist.mockRejectedValueOnce( new Error( 'MusicBrainz error' ) );
      musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      // Advance through all 3 updates (90 seconds total)
      await jest.advanceTimersByTimeAsync( 90000 );

      const result = await promise;

      expect( result ).toBe( 3 );
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 3 );
      expect( database.cacheArtist ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that runSequentialUpdate handles getAllActsWithMetadata error
     */
    test( 'returns 0 on getAllActsWithMetadata error', async () => {
      database.getAllActsWithMetadata.mockRejectedValue( new Error( 'Database error' ) );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'start with sequential bootstrap', () => {
    /**
     * Test that start runs sequential update, waits 12h, then starts cycle
     */
    test( 'runs sequential update, waits 12h, then starts cycle-based', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedTheKinks._id ];

      const actsWithMetadata = [
        {
          '_id': transformedTheKinks._id,
          'updatedAt': new Date( Date.now() - 48 * 60 * 60 * 1000 ).toISOString()
        }
      ];

      database.getAllActIds.mockResolvedValue( actIds );
      database.getAllActsWithMetadata.mockResolvedValue( actsWithMetadata );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      // Start the dual strategy
      cacheUpdater.start( {
        'cycleIntervalMs': 100,
        'retryDelayMs': 20
      } );

      // Phase 1: Sequential update (1 act × 30s = 30s)
      await jest.advanceTimersByTimeAsync( 30000 );

      expect( database.getAllActsWithMetadata ).toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalled();

      const callsAfterSequential = database.cacheArtist.mock.calls.length;

      // Phase 2: 12-hour wait
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Phase 3: First cycle-based update
      await jest.advanceTimersByTimeAsync( 100 );

      const callsAfterCycle = database.cacheArtist.mock.calls.length;

      expect( callsAfterCycle ).toBeGreaterThan( callsAfterSequential );

      jest.useRealTimers();
    }, 20000 );
  } );
} );
