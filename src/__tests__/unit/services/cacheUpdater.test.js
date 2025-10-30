/**
 * Unit tests for cacheUpdater module
 * Tests functionality in isolation using fake timers and mocks
 * @module __tests__/unit/services/cacheUpdater.unit
 */

describe( 'cacheUpdater - Unit Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Load modules
    require( '../../../services/database' );
    require( '../../../services/actService' );
    require( '../../../services/cacheUpdater' );

    // Spy on database functions used by cacheUpdater
    jest.spyOn( mf.database, 'cacheAct' ).mockResolvedValue();
    jest.spyOn( mf.database, 'getAllActsWithMetadata' ).mockResolvedValue( [] );
    jest.spyOn( mf.database, 'getAllActIds' ).mockResolvedValue( [] );

    // Spy on actService function
    jest.spyOn( mf.actService, 'fetchAndEnrichActData' ).mockResolvedValue( {} );
  } );

  afterEach( () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  } );

  describe( 'updateAct', () => {
    /**
     * Test that updateAct calls fetchAndEnrichActData
     */
    test( 'calls fetchAndEnrichActData with act ID', async () => {
      mf.actService.fetchAndEnrichActData.mockResolvedValue( {
        '_id': 'test-id',
        'name': 'Test Artist'
      } );
      mf.database.cacheAct.mockResolvedValue();

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'test-id', true );
    } );

    /**
     * Test that updateAct passes silentEventFail=true
     */
    test( 'passes silentEventFail=true to fetchAndEnrichActData', async () => {
      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      await mf.cacheUpdater.updateAct( 'test-id' );

      // Second parameter should be true (silent event failures)
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'test-id', true );
    } );

    /**
     * Test that updateAct caches fetched data
     */
    test( 'caches the fetched act data', async () => {
      const mockData = {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      };

      mf.actService.fetchAndEnrichActData.mockResolvedValue( mockData );
      mf.database.cacheAct.mockResolvedValue();

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.cacheAct ).toHaveBeenCalledWith( mockData );
    } );

    /**
     * Test that updateAct handles fetch errors without throwing
     */
    test( 'handles fetchAndEnrichActData errors without throwing', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'Fetch failed' ) );

      // Should not throw
      await expect( mf.cacheUpdater.updateAct( 'test-id' ) ).resolves.not.toThrow();

      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to update act test-id' ),
        expect.any( String )
      );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test that updateAct handles cache errors without throwing
     */
    test( 'handles mf.database.cacheAct errors without throwing', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockRejectedValue( new Error( 'Cache failed' ) );

      // Should not throw
      await expect( mf.cacheUpdater.updateAct( 'test-id' ) ).resolves.not.toThrow();

      expect( consoleErrorSpy ).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test that updateAct logs errors to database on failure
     */
    test( 'logs error to database when fetchAndEnrichActData fails', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'MusicBrainz API error' ) );

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.logUpdateError ).toHaveBeenCalledWith( {
        'timestamp': expect.stringMatching( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+0[12]:00$/u ),
        'actId': 'test-id',
        'errorMessage': 'MusicBrainz API error',
        'errorSource': 'musicbrainz'
      } );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test error source detection for musicbrainz errors
     */
    test( 'detects musicbrainz error source correctly', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'MB_001 error' ) );

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.logUpdateError ).toHaveBeenCalledWith( expect.objectContaining( {
        'errorSource': 'musicbrainz'
      } ) );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test error source detection for bandsintown errors
     */
    test( 'detects bandsintown error source correctly', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'Bandsintown fetch failed' ) );

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.logUpdateError ).toHaveBeenCalledWith( expect.objectContaining( {
        'errorSource': 'bandsintown'
      } ) );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test error source detection for cache errors
     */
    test( 'detects cache error source correctly', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockRejectedValue( new Error( 'DB_005 cache error' ) );

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.logUpdateError ).toHaveBeenCalledWith( expect.objectContaining( {
        'errorSource': 'cache'
      } ) );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test error source defaults to unknown for unrecognized errors
     */
    test( 'defaults to unknown error source for unrecognized errors', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'Unknown error' ) );

      await mf.cacheUpdater.updateAct( 'test-id' );

      expect( mf.database.logUpdateError ).toHaveBeenCalledWith( expect.objectContaining( {
        'errorSource': 'unknown'
      } ) );

      consoleErrorSpy.mockRestore();
    } );

    /**
     * Test handles error logging failures gracefully
     */
    test( 'handles error logging failures gracefully without throwing', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      jest.spyOn( mf.database, 'logUpdateError' ).mockRejectedValue( new Error( 'Logging failed' ) );
      jest.spyOn( mf.actService, 'getBerlinTimestamp' ).mockImplementation( () => {
        const dateStr = new Date().toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

        return `${dateStr.replace( ' ', ' ' )}+01:00`;
      } );

      mf.actService.fetchAndEnrichActData.mockRejectedValue( new Error( 'Some error' ) );

      await expect( mf.cacheUpdater.updateAct( 'test-id' ) ).resolves.not.toThrow();

      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        expect.stringContaining( 'Failed to log error for act test-id' ),
        expect.any( String )
      );

      consoleErrorSpy.mockRestore();
    } );
  } );

  describe( 'runSequentialUpdate', () => {
    /**
     * Test that runSequentialUpdate calls getAllActsWithMetadata
     */
    test( 'calls mf.database.getAllActsWithMetadata', async () => {
      jest.useFakeTimers();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );

      await mf.cacheUpdater.runSequentialUpdate();

      expect( mf.database.getAllActsWithMetadata ).toHaveBeenCalled();

      jest.useRealTimers();
    } );

    /**
     * Test that runSequentialUpdate returns 0 when no acts
     */
    test( 'returns 0 when cache is empty', async () => {
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );

      const result = await mf.cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
    } );

    /**
     * Test that runSequentialUpdate returns 0 when all acts are fresh
     */
    test( 'returns 0 when all acts are fresh (< 24h old)', async () => {
      // 1 hour ago
      const freshTimestamp = new Date( Date.now() - ( 1000 * 60 * 60 ) ).toISOString();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'test-id',
          'updatedAt': freshTimestamp
        }
      ] );

      const result = await mf.cacheUpdater.runSequentialUpdate();

      expect( result ).toBe( 0 );
      expect( mf.actService.fetchAndEnrichActData ).not.toHaveBeenCalled();
    } );

    /**
     * Test that runSequentialUpdate processes acts with missing updatedAt
     */
    test( 'processes acts with missing updatedAt field', async () => {
      jest.useFakeTimers();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'test-id'
          // No updatedAt
        }
      ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.cacheUpdater.runSequentialUpdate();

      await jest.runAllTimersAsync();

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'test-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate processes stale acts (> 24h)
     */
    test( 'processes acts older than 24 hours', async () => {
      jest.useFakeTimers();

      const staleTimestamp = new Date( Date.now() - ( 48 * 60 * 60 * 1000 ) ).toISOString();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'stale-id',
          'updatedAt': staleTimestamp
        }
      ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.cacheUpdater.runSequentialUpdate();

      await jest.runAllTimersAsync();

      const result = await promise;

      expect( result ).toBe( 1 );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'stale-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate waits 30s between acts
     */
    test( 'waits 30 seconds between updating acts', async () => {
      jest.useFakeTimers();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'id1'
        },
        {
          '_id': 'id2'
        }
      ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.cacheUpdater.runSequentialUpdate();

      // Fast-forward through all timers to completion
      await jest.runAllTimersAsync();
      await promise;

      // Both acts should have been processed
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 2 );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id1', true );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that runSequentialUpdate handles errors gracefully
     */
    test( 'continues and returns 0 on getAllActsWithMetadata error', async () => {
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      mf.database.getAllActsWithMetadata.mockRejectedValue( new Error( 'DB error' ) );

      const result = await mf.cacheUpdater.runSequentialUpdate();

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
      expect( typeof mf.cacheUpdater.start ).toBe( 'function' );
    } );

    /**
     * Test that start uses default cycleIntervalMs when undefined
     */
    test( 'uses default cycleIntervalMs when explicitly undefined', async () => {
      jest.useFakeTimers();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getAllActIds.mockResolvedValue( [] );

      // Pass undefined for cycleIntervalMs to test the ?? operator
      mf.cacheUpdater.start( { 'cycleIntervalMs': undefined } );

      // Should call runSequentialUpdate once
      await jest.advanceTimersByTimeAsync( 1000 );
      expect( mf.database.getAllActsWithMetadata ).toHaveBeenCalledTimes( 1 );

      jest.useRealTimers();
    } );

    /**
     * Test that start runs runCycle in infinite loop (while true)
     */
    test( 'runs runCycle multiple times in infinite loop', async () => {
      jest.useFakeTimers();

      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getAllActIds.mockResolvedValue( [] );

      mf.cacheUpdater.start( { 'cycleIntervalMs': 1000 } );

      // Let runSequentialUpdate complete
      await jest.advanceTimersByTimeAsync( 1000 );

      // Let 12-hour sleep complete
      await jest.advanceTimersByTimeAsync( 12 * 60 * 60 * 1000 );

      // Now should be in while(true) loop - verify runCycle is called multiple times
      await jest.advanceTimersByTimeAsync( 5000 );

      // Should have called getAllActIds multiple times (once per cycle)
      expect( mf.database.getAllActIds ).toHaveBeenCalled();
      const initialCalls = mf.database.getAllActIds.mock.calls.length;

      // Advance more and verify it keeps cycling
      await jest.advanceTimersByTimeAsync( 5000 );

      expect( mf.database.getAllActIds.mock.calls.length ).toBeGreaterThan( initialCalls );

      jest.useRealTimers();
    }, 20000 );
  } );

  describe( 'sleep', () => {
    /**
     * Test that sleep is exported when running under Jest
     */
    test( 'is exported when JEST_WORKER_ID is set', () => {
      expect( typeof mf.testing.cacheUpdater.sleep ).toBe( 'function' );
    } );

    /**
     * Test that sleep waits specified milliseconds
     */
    test( 'resolves after specified milliseconds', async () => {
      jest.useFakeTimers();

      const promise = mf.testing.cacheUpdater.sleep( 5000 );

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
      expect( typeof mf.testing.cacheUpdater.runCycle ).toBe( 'function' );
    } );

    /**
     * Test runCycle with no acts - should sleep for cycle interval
     */
    test( 'sleeps for cycleIntervalMs when no acts in cache', async () => {
      jest.useFakeTimers();

      mf.database.getAllActIds.mockResolvedValue( [] );

      const promise = mf.testing.cacheUpdater.runCycle( 10000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      expect( mf.database.getAllActIds ).toHaveBeenCalled();

      jest.useRealTimers();
    } );

    /**
     * Test runCycle updates all acts
     */
    test( 'updates all acts in sequence', async () => {
      jest.useFakeTimers();

      mf.database.getAllActIds.mockResolvedValue( [ 'id1', 'id2', 'id3' ] );
      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.cacheUpdater.runCycle( 30000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 3 );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id1', true );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id2', true );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id3', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test runCycle calculates time slice correctly
     */
    test( 'calculates time slice as cycleIntervalMs divided by number of acts', async () => {
      jest.useFakeTimers();

      mf.database.getAllActIds.mockResolvedValue( [ 'id1', 'id2' ] );
      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.cacheUpdater.runCycle( 10000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      // With 2 acts and 10000ms cycle, time slice should be 5000ms per act
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test runCycle handles errors and sleeps for retry delay
     */
    test( 'catches errors and sleeps for retryDelayMs', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      mf.database.getAllActIds.mockRejectedValue( new Error( 'DB error' ) );

      const promise = mf.testing.cacheUpdater.runCycle( 10000, 5000 );

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

      mf.database.getAllActIds.mockResolvedValue( [ 'id1', 'id2', 'id3' ] );
      mf.actService.fetchAndEnrichActData.
        mockResolvedValueOnce( {} ).
        mockRejectedValueOnce( new Error( 'Fetch failed' ) ).
        mockResolvedValueOnce( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.cacheUpdater.runCycle( 30000, 5000 );

      await jest.runAllTimersAsync();
      await promise;

      // All three should still be attempted despite error on id2
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 3 );

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }, 15000 );
  } );
} );
