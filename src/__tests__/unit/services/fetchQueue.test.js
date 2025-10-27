/**
 * Unit tests for fetchQueue module
 * Tests functionality in isolation using fake timers and mocks
 * @module __tests__/unit/services/fetchQueue
 */

describe( 'fetchQueue - Unit Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Load modules
    require( '../../../services/database' );
    require( '../../../services/actService' );
    require( '../../../services/fetchQueue' );

    // Spy on database functions used by fetchQueue
    jest.spyOn( mf.database, 'cacheAct' ).mockResolvedValue();

    // Spy on actService function
    jest.spyOn( mf.actService, 'fetchAndEnrichActData' ).mockResolvedValue( {} );
  } );

  afterEach( () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  } );

  describe( 'processFetchQueue', () => {
    /**
     * Test that processFetchQueue calls fetchAndEnrichActData for each ID
     */
    test( 'calls fetchAndEnrichActData for each ID in queue', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {
        '_id': 'test',
        'name': 'Test'
      } );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 2 );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id1', true );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue passes silentEventFail=true
     */
    test( 'passes silentEventFail=true to fetchAndEnrichActData', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'test-id' ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Second parameter should be true (silent event failures)
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'test-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue caches fetched data
     */
    test( 'caches fetched act data', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'test-id' ] );
      const mockData = {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      };

      mf.actService.fetchAndEnrichActData.mockResolvedValue( mockData );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      expect( mf.database.cacheAct ).toHaveBeenCalledWith( mockData );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue handles fetch errors without throwing
     */
    test( 'continues processing after fetch error', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      mf.actService.fetchAndEnrichActData.
        mockRejectedValueOnce( new Error( 'Fetch failed' ) ).
        mockResolvedValueOnce( { '_id': 'id2' } );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Should continue to second ID despite first error
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue handles cache errors without throwing
     */
    test( 'continues processing after cache error', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.
        mockRejectedValueOnce( new Error( 'Cache failed' ) ).
        mockResolvedValueOnce();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Should continue to second ID despite cache error
      expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue removes IDs from queue
     */
    test( 'removes IDs from queue before processing', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1' ] );

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      const promise = mf.testing.fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Queue should be empty after processing
      expect( queue.size ).toBe( 0 );

      jest.useRealTimers();
    }, 15000 );
  } );

  describe( 'triggerBackgroundFetch', () => {
    /**
     * Test that triggerBackgroundFetch is a function
     */
    test( 'is exported as a function', () => {
      expect( typeof mf.fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
    } );

    /**
     * Test that triggerBackgroundFetch accepts an array
     */
    test( 'accepts an array of act IDs', async () => {
      jest.useFakeTimers();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( {} );
      mf.database.cacheAct.mockResolvedValue();

      // Should not throw
      expect( () => mf.fetchQueue.triggerBackgroundFetch( [ 'id1', 'id2' ] ) ).not.toThrow();

      // Clean up background promises
      await jest.runAllTimersAsync();

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that triggerBackgroundFetch does not start duplicate processor
     */
    test( 'returns early if background fetch already running', async () => {
      jest.useFakeTimers();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheAct.mockResolvedValue();

      // First call - starts processor
      mf.fetchQueue.triggerBackgroundFetch( [ 'id1' ] );

      // Second call - should return early while first is running
      mf.fetchQueue.triggerBackgroundFetch( [ 'id2' ] );

      await jest.runAllTimersAsync();

      // Both IDs should still be processed (id2 was added to queue)
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id1', true );
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that triggerBackgroundFetch resets flag on completion
     */
    test( 'resets isBackgroundFetchRunning flag on successful completion', async () => {
      jest.useFakeTimers();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheAct.mockResolvedValue();

      // First call
      mf.fetchQueue.triggerBackgroundFetch( [ 'id1' ] );

      await jest.runAllTimersAsync();

      // Second call - should work because flag was reset after completion
      mf.actService.fetchAndEnrichActData.mockClear();
      mf.fetchQueue.triggerBackgroundFetch( [ 'id2' ] );

      await jest.runAllTimersAsync();

      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test error handler in triggerBackgroundFetch catch block
     */
    test( 'resets flag and logs error when processFetchQueue throws', async () => {
      jest.useFakeTimers();

      /**
       * No-op function for console.error mock
       * @returns {void} Nothing
       */
      const noOp = () => {
        // Intentionally empty - suppresses console output during test
      };

      // Spy on console.error to suppress output and verify it was called
      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation( noOp );

      // Clear modules to force re-require
      jest.resetModules();

      // Set up a throwing mock for actService before requiring anything
      jest.doMock( '../../../services/actService', () => {
        throw new Error( 'Simulated require failure' );
      } );

      // Re-require database and setup mocks
      require( '../../../services/database' );
      jest.spyOn( mf.database, 'cacheAct' ).mockResolvedValue();

      // Require fetchQueue (this will have the broken actService require)
      require( '../../../services/fetchQueue' );

      // Trigger background fetch - this will cause processFetchQueue to throw
      mf.fetchQueue.triggerBackgroundFetch( [ 'test-id' ] );

      // Wait for promise to settle
      await jest.runAllTimersAsync();

      // Verify console.error was called with error message
      expect( consoleErrorSpy ).toHaveBeenCalledWith( 'Background fetch error:', 'Simulated require failure' );

      // Cleanup
      consoleErrorSpy.mockRestore();
      jest.clearAllMocks();
      jest.resetModules();
      jest.dontMock( '../../../services/actService' );

      // Re-require everything for subsequent tests
      require( '../../../services/database' );
      require( '../../../services/actService' );
      require( '../../../services/fetchQueue' );
      jest.spyOn( mf.database, 'cacheAct' ).mockResolvedValue();
      jest.spyOn( mf.actService, 'fetchAndEnrichActData' ).mockResolvedValue( {} );

      jest.useRealTimers();
    }, 15000 );
  } );

  describe( 'setIsRunning (test helper)', () => {
    /**
     * Test that setIsRunning function is exposed for testing
     */
    test( 'is exposed in mf.testing.fetchQueue', () => {
      expect( typeof mf.testing.fetchQueue.setIsRunning ).toBe( 'function' );
    } );

    /**
     * Test that setIsRunning correctly sets the flag to true
     */
    test( 'sets isBackgroundFetchRunning flag to true', async () => {
      jest.useFakeTimers();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheAct.mockResolvedValue();

      // Set flag to true using setIsRunning
      mf.testing.fetchQueue.setIsRunning( true );

      // Try to trigger background fetch - should return early because flag is true
      mf.fetchQueue.triggerBackgroundFetch( [ 'test-id' ] );

      await jest.runAllTimersAsync();

      // Should not have called fetchAndEnrichActData because flag was already true
      expect( mf.actService.fetchAndEnrichActData ).not.toHaveBeenCalled();

      // Reset flag for subsequent tests
      mf.testing.fetchQueue.setIsRunning( false );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that setIsRunning correctly sets the flag to false
     */
    test( 'sets isBackgroundFetchRunning flag to false', async () => {
      jest.useFakeTimers();

      mf.actService.fetchAndEnrichActData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheAct.mockResolvedValue();

      // Set flag to false using setIsRunning
      mf.testing.fetchQueue.setIsRunning( false );

      // Trigger background fetch - should work because flag is false
      mf.fetchQueue.triggerBackgroundFetch( [ 'test-id' ] );

      await jest.runAllTimersAsync();

      // Should have called fetchAndEnrichActData because flag was false
      expect( mf.actService.fetchAndEnrichActData ).toHaveBeenCalledWith( 'test-id', true );

      // Reset flag for subsequent tests
      mf.testing.fetchQueue.setIsRunning( false );

      jest.useRealTimers();
    }, 15000 );
  } );
} );
