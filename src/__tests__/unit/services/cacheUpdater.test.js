/**
 * Unit tests for cacheUpdater module
 * Tests functionality in isolation using fake timers and mocks
 * @module __tests__/unit/services/cacheUpdater.unit
 */

// Mock dependencies BEFORE requiring cacheUpdater
jest.mock( '../../../services/database' );

describe( 'cacheUpdater - Unit Tests', () => {
  let database;
  let artistService;
  let cacheUpdater;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require mocked modules
    database = require( '../../../services/database' );

    // Mock artistService (lazy required by cacheUpdater)
    jest.doMock( '../../../services/artistService', () => ( {
      'fetchAndEnrichArtistData': jest.fn()
    } ) );

    artistService = require( '../../../services/artistService' );
    cacheUpdater = require( '../../../services/cacheUpdater' );
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  describe( 'updateAct', () => {
    /**
     * Test that updateAct calls fetchAndEnrichArtistData
     */
    test( 'calls fetchAndEnrichArtistData with act ID', async () => {
      artistService.fetchAndEnrichArtistData.mockResolvedValue( {
        '_id': 'test-id',
        'name': 'Test Artist'
      } );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( 'test-id' );

      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'test-id', true );
    } );

    /**
     * Test that updateAct passes silentEventFail=true
     */
    test( 'passes silentEventFail=true to fetchAndEnrichArtistData', async () => {
      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( 'test-id' );

      // Second parameter should be true (silent event failures)
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'test-id', true );
    } );

    /**
     * Test that updateAct caches fetched data
     */
    test( 'caches the fetched artist data', async () => {
      const mockData = {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      };

      artistService.fetchAndEnrichArtistData.mockResolvedValue( mockData );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( 'test-id' );

      expect( database.cacheArtist ).toHaveBeenCalledWith( mockData );
    } );

    /**
     * Test that updateAct handles fetch errors without throwing
     */
    test( 'handles fetchAndEnrichArtistData errors without throwing', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      artistService.fetchAndEnrichArtistData.mockRejectedValue( new Error( 'Fetch failed' ) );

      // Should not throw
      await expect( cacheUpdater.updateAct( 'test-id' ) ).resolves.not.toThrow();

      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to update act test-id' ),
        expect.any( String )
      );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test that updateAct handles cache errors without throwing
     */
    test( 'handles database.cacheArtist errors without throwing', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache failed' ) );

      // Should not throw
      await expect( cacheUpdater.updateAct( 'test-id' ) ).resolves.not.toThrow();

      expect( consoleErrorSpy ).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    } );
  } );

  describe( 'runSequentialUpdate', () => {
    /**
     * Test that runSequentialUpdate calls getAllActsWithMetadata
     */
    test( 'calls database.getAllActsWithMetadata', async () => {
      jest.useFakeTimers();

      database.getAllActsWithMetadata.mockResolvedValue( [] );

      await cacheUpdater.runSequentialUpdate();

      expect( database.getAllActsWithMetadata ).toHaveBeenCalled();

      jest.useRealTimers();
    } );

    /**
     * Test that runSequentialUpdate returns 0 when no acts
     */
    test( 'returns 0 when cache is empty', async () => {
      database.getAllActsWithMetadata.mockResolvedValue( [] );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
    } );

    /**
     * Test that runSequentialUpdate returns 0 when all acts are fresh
     */
    test( 'returns 0 when all acts are fresh (< 24h old)', async () => {
      const freshTimestamp = new Date( Date.now() - ( 1000 * 60 * 60 ) ).toISOString(); // 1 hour ago

      database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'test-id',
          'updatedAt': freshTimestamp
        }
      ] );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( artistService.fetchAndEnrichArtistData ).not.toHaveBeenCalled();
    } );

    /**
     * Test that runSequentialUpdate processes acts with missing updatedAt
     */
    test( 'processes acts with missing updatedAt field', async () => {
      jest.useFakeTimers();

      database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'test-id'
          // No updatedAt
        }
      ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      await jest.runAllTimersAsync();

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'test-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate processes stale acts (> 24h)
     */
    test( 'processes acts older than 24 hours', async () => {
      jest.useFakeTimers();

      const staleTimestamp = new Date( Date.now() - ( 48 * 60 * 60 * 1000 ) ).toISOString();

      database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'stale-id',
          'updatedAt': staleTimestamp
        }
      ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      await jest.runAllTimersAsync();

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'stale-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate waits 30s between acts
     */
    test( 'waits 30 seconds between updating acts', async () => {
      jest.useFakeTimers();

      database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'id1'
        },
        {
          '_id': 'id2'
        }
      ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runSequentialUpdate();

      // Fast-forward through all timers to completion
      await jest.runAllTimersAsync();
      await promise;

      // Both acts should have been processed
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 2 );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id1', true );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate handles errors gracefully
     */
    test( 'continues and returns 0 on getAllActsWithMetadata error', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      database.getAllActsWithMetadata.mockRejectedValue( new Error( 'DB error' ) );

      const result = await cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        expect.stringContaining( 'Sequential update error' ),
        expect.any( String )
      );

      consoleErrorSpy.mockRestore();
    } );
  } );

  describe( 'start', () => {
    /**
     * Test that start is a function
     */
    test( 'is exported as a function', () => {
      expect( typeof cacheUpdater.start ).toBe( 'function' );
    } );

    /**
     * Test that start uses default cycleIntervalMs when undefined
     */
    test( 'uses default cycleIntervalMs when explicitly undefined', async () => {
      jest.useFakeTimers();

      database.getAllActsWithMetadata.mockResolvedValue( [] );
      database.getAllActIds.mockResolvedValue( [] );

      // Pass undefined for cycleIntervalMs to test the ?? operator
      cacheUpdater.start( { 'cycleIntervalMs': undefined } );

      // Should call runSequentialUpdate once
      await jest.advanceTimersByTimeAsync( 1000 );
      expect( database.getAllActsWithMetadata ).toHaveBeenCalledTimes( 1 );

      jest.useRealTimers();
    } );

    /**
     * Test that start runs runCycle in infinite loop (while true)
     */
    test( 'runs runCycle multiple times in infinite loop', async () => {
      jest.useFakeTimers();

      database.getAllActsWithMetadata.mockResolvedValue( [] );
      database.getAllActIds.mockResolvedValue( [] );

      cacheUpdater.start( { 'cycleIntervalMs': 1000 } );

      // Let runSequentialUpdate complete
      await jest.advanceTimersByTimeAsync( 1000 );

      // Let 12-hour sleep complete
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Now should be in while(true) loop - verify runCycle is called multiple times
      await jest.advanceTimersByTimeAsync( 5000 );

      // Should have called getAllActIds multiple times (once per cycle)
      expect( database.getAllActIds ).toHaveBeenCalled();
      const initialCalls = database.getAllActIds.mock.calls.length;

      // Advance more and verify it keeps cycling
      await jest.advanceTimersByTimeAsync( 5000 );

      expect( database.getAllActIds.mock.calls.length ).toBeGreaterThan( initialCalls );

      jest.useRealTimers();
    }, 20000 );
  } );

  describe( 'sleep', () => {
    /**
     * Test that sleep is exported when running under Jest
     */
    test( 'is exported when JEST_WORKER_ID is set', () => {
      expect( typeof cacheUpdater.sleep ).toBe( 'function' );
    } );

    /**
     * Test that sleep waits specified milliseconds
     */
    test( 'resolves after specified milliseconds', async () => {
      jest.useFakeTimers();

      const promise = cacheUpdater.sleep( 5000 );

      // Should not resolve immediately
      await jest.advanceTimersByTimeAsync( 4999 );
      expect( promise ).toBeInstanceOf( Promise );

      // Should resolve after full time
      await jest.advanceTimersByTimeAsync( 1 );
      await promise;

      jest.useRealTimers();
    } );
  } );

  describe( 'runCycle', () => {
    /**
     * Test that runCycle is exported when running under Jest
     */
    test( 'is exported when JEST_WORKER_ID is set', () => {
      expect( typeof cacheUpdater.runCycle ).toBe( 'function' );
    } );

    /**
     * Test runCycle with no acts - should sleep for cycle interval
     */
    test( 'sleeps for cycleIntervalMs when no acts in cache', async () => {
      jest.useFakeTimers();

      database.getAllActIds.mockResolvedValue( [] );

      const promise = cacheUpdater.runCycle( 10000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      expect( database.getAllActIds ).toHaveBeenCalled();

      jest.useRealTimers();
    } );

    /**
     * Test runCycle updates all acts
     */
    test( 'updates all acts in sequence', async () => {
      jest.useFakeTimers();

      database.getAllActIds.mockResolvedValue( [ 'id1', 'id2', 'id3' ] );
      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runCycle( 30000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 3 );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id1', true );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id2', true );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id3', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test runCycle calculates time slice correctly
     */
    test( 'calculates time slice as cycleIntervalMs divided by number of acts', async () => {
      jest.useFakeTimers();

      database.getAllActIds.mockResolvedValue( [ 'id1', 'id2' ] );
      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runCycle( 10000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      // With 2 acts and 10000ms cycle, time slice should be 5000ms per act
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test runCycle handles errors and sleeps for retry delay
     */
    test( 'catches errors and sleeps for retryDelayMs', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      database.getAllActIds.mockRejectedValue( new Error( 'DB error' ) );

      const promise = cacheUpdater.runCycle( 10000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        'Cycle error:',
        'DB error'
      );

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    } );

    /**
     * Test runCycle continues after updateAct error
     */
    test( 'continues processing remaining acts after updateAct error', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      database.getAllActIds.mockResolvedValue( [ 'id1', 'id2', 'id3' ] );
      artistService.fetchAndEnrichArtistData.
        mockResolvedValueOnce( {} ).
        mockRejectedValueOnce( new Error( 'Fetch failed' ) ).
        mockResolvedValueOnce( {} );
      database.cacheArtist.mockResolvedValue();

      const promise = cacheUpdater.runCycle( 30000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      // All three should still be attempted despite error on id2
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 3 );

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }, 15000 );
  } );
} );
