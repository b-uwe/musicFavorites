/**
 * Unit tests for fetchQueue module
 * Tests functionality in isolation using fake timers and mocks
 * @module __tests__/unit/services/fetchQueue
 */

// Mock dependencies BEFORE requiring fetchQueue
jest.mock( '../../../services/artistService' );
jest.mock( '../../../services/database' );

describe( 'fetchQueue - Unit Tests', () => {
  let artistService;
  let fetchQueue;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Require database module (sets up mf.database with real implementations)
    require( '../../../services/database' );

    // Mock only the database functions used by fetchQueue
    globalThis.mf.database.cacheArtist = jest.fn();

    artistService = require( '../../../services/artistService' );
    fetchQueue = require( '../../../services/fetchQueue' );
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  describe( 'processFetchQueue', () => {
    /**
     * Test that processFetchQueue calls fetchAndEnrichArtistData for each ID
     */
    test( 'calls fetchAndEnrichArtistData for each ID in queue', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {
        '_id': 'test',
        'name': 'Test'
      } );
      mf.database.cacheArtist.mockResolvedValue();

      const promise = fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 2 );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id1', true );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue passes silentEventFail=true
     */
    test( 'passes silentEventFail=true to fetchAndEnrichArtistData', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'test-id' ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      mf.database.cacheArtist.mockResolvedValue();

      const promise = fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Second parameter should be true (silent event failures)
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'test-id', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue caches fetched data
     */
    test( 'caches fetched artist data', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'test-id' ] );
      const mockData = {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      };

      artistService.fetchAndEnrichArtistData.mockResolvedValue( mockData );
      mf.database.cacheArtist.mockResolvedValue();

      const promise = fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      expect( mf.database.cacheArtist ).toHaveBeenCalledWith( mockData );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue handles fetch errors without throwing
     */
    test( 'continues processing after fetch error', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      artistService.fetchAndEnrichArtistData.
        mockRejectedValueOnce( new Error( 'Fetch failed' ) ).
        mockResolvedValueOnce( { '_id': 'id2' } );
      mf.database.cacheArtist.mockResolvedValue();

      const promise = fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Should continue to second ID despite first error
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue handles cache errors without throwing
     */
    test( 'continues processing after cache error', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1', 'id2' ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      mf.database.cacheArtist.
        mockRejectedValueOnce( new Error( 'Cache failed' ) ).
        mockResolvedValueOnce();

      const promise = fetchQueue.processFetchQueue( queue );

      await jest.runAllTimersAsync();
      await promise;

      // Should continue to second ID despite cache error
      expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that processFetchQueue removes IDs from queue
     */
    test( 'removes IDs from queue before processing', async () => {
      jest.useFakeTimers();

      const queue = new Set( [ 'id1' ] );

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      mf.database.cacheArtist.mockResolvedValue();

      const promise = fetchQueue.processFetchQueue( queue );

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
      expect( typeof fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
    } );

    /**
     * Test that triggerBackgroundFetch accepts an array
     */
    test( 'accepts an array of artist IDs', async () => {
      jest.useFakeTimers();

      artistService.fetchAndEnrichArtistData.mockResolvedValue( {} );
      mf.database.cacheArtist.mockResolvedValue();

      // Should not throw
      expect( () => fetchQueue.triggerBackgroundFetch( [ 'id1', 'id2' ] ) ).not.toThrow();

      // Clean up background promises
      await jest.runAllTimersAsync();

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that triggerBackgroundFetch does not start duplicate processor
     */
    test( 'returns early if background fetch already running', async () => {
      jest.useFakeTimers();

      artistService.fetchAndEnrichArtistData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheArtist.mockResolvedValue();

      // First call - starts processor
      fetchQueue.triggerBackgroundFetch( [ 'id1' ] );

      // Second call - should return early while first is running
      fetchQueue.triggerBackgroundFetch( [ 'id2' ] );

      await jest.runAllTimersAsync();

      // Both IDs should still be processed (id2 was added to queue)
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id1', true );
      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );

    /**
     * Test that triggerBackgroundFetch resets flag on completion
     */
    test( 'resets isBackgroundFetchRunning flag on successful completion', async () => {
      jest.useFakeTimers();

      artistService.fetchAndEnrichArtistData.mockResolvedValue( { '_id': 'id1' } );
      mf.database.cacheArtist.mockResolvedValue();

      // First call
      fetchQueue.triggerBackgroundFetch( [ 'id1' ] );

      await jest.runAllTimersAsync();

      // Second call - should work because flag was reset after completion
      artistService.fetchAndEnrichArtistData.mockClear();
      fetchQueue.triggerBackgroundFetch( [ 'id2' ] );

      await jest.runAllTimersAsync();

      expect( artistService.fetchAndEnrichArtistData ).toHaveBeenCalledWith( 'id2', true );

      jest.useRealTimers();
    }, 15000 );
  } );
} );
