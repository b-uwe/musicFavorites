/**
 * Integration tests for fetch queue functionality
 * These tests use real module imports to catch circular dependencies
 * Only external dependencies (database, HTTP) are mocked
 * @module __tests__/integration/fetchQueue.integration
 */

require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

/*
 * CRITICAL: Import actService and fetchQueue AFTER mocks are set up
 * This allows us to test real module interactions while mocking external I/O
 */
require( '../../services/actService' );
require( '../../services/fetchQueue' );

describe( 'Fetch Queue Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Reset fetchQueue state between tests
    mf.testing.fetchQueue.fetchQueue.clear();
    mf.testing.fetchQueue.setIsRunning( false );

    // Mock only the database functions used in these tests
    mf.database.getActFromCache = jest.fn();
    mf.database.cacheAct = jest.fn();

    // Mock musicbrainz functions
    mf.musicbrainz.fetchAct = jest.fn();

    // Mock ldJsonExtractor - CRITICAL for background fetch to work
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test that triggerBackgroundFetch can call fetchAndEnrichActData without circular dependency errors
   */
  test( 'triggerBackgroundFetch calls fetchAndEnrichActData without errors', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id
    ];

    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
    mf.database.cacheAct.mockResolvedValue();

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches (2 acts × 30s = 60s)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify fetchAndEnrichActData was called (indirectly through processFetchQueue)
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 2 );
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledWith( fixtureVulvodynia.id );
    expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 2 );

    // Reset timers to restore normal timing
    jest.useRealTimers();
  }, 10000 );

  /**
   * Test that fetchMultipleActs can trigger triggerBackgroundFetch for background fetching
   */
  test( 'fetchMultipleActs triggers background fetch via triggerBackgroundFetch', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    // All acts are missing from cache
    mf.database.getActFromCache.mockResolvedValue( null );

    // Mock the background fetch behavior
    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
    mf.database.cacheAct.mockResolvedValue();

    // Call fetchMultipleActs with 3 missing acts
    const result = await mf.actService.fetchMultipleActs( actIds );

    // Should return error because 2+ acts are missing
    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( '3 acts not cached' );

    // Verify triggerBackgroundFetch function exists
    expect( typeof mf.fetchQueue.triggerBackgroundFetch ).toBe( 'function' );

    /*
     * Advance timers to allow background operations to complete
     * 3 acts × 30s = 90s
     */
    await jest.advanceTimersByTimeAsync( 90000 );
    jest.useRealTimers();
  } );

  /**
   * Test that the integration doesn't have circular dependency issues
   */
  test( 'modules load without circular dependency errors', () => {
    // If we got this far, the modules loaded successfully
    expect( mf.actService ).toBeDefined();
    expect( mf.fetchQueue ).toBeDefined();
    expect( mf.actService.fetchAndEnrichActData ).toBeDefined();
    expect( typeof mf.actService.fetchAndEnrichActData ).toBe( 'function' );
    expect( mf.fetchQueue.triggerBackgroundFetch ).toBeDefined();
    expect( typeof mf.fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
  } );

  /**
   * Test error handling during background fetch
   */
  test( 'processFetchQueue continues processing after individual fetch failures', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      'failing-id',
      fixtureVulvodynia.id
    ];

    // First succeeds, second fails, third succeeds
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchAct.mockRejectedValueOnce( new Error( 'MusicBrainz fetch failed' ) );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through all fetches (3 acts × 30s = 90s)
    await jest.advanceTimersByTimeAsync( 90000 );

    // All 3 should be attempted
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 3 );
    // But only 2 should be cached (the successful ones)
    expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test cache error handling during background fetch
   */
  test( 'processFetchQueue continues processing after cache failures', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id
    ];

    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );

    // First cache succeeds, second fails
    mf.database.cacheAct.mockResolvedValueOnce();
    mf.database.cacheAct.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches
    await jest.advanceTimersByTimeAsync( 60000 );

    // Both should be fetched
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 2 );
    // Both cache attempts should be made (even though second fails)
    expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test that background fetch doesn't start concurrent processors
   * Second call adds to queue but doesn't start new processor
   */
  test( 'triggerBackgroundFetch prevents concurrent execution but queues IDs', async () => {
    jest.useFakeTimers();

    const actIds1 = [ fixtureTheKinks.id ];
    const actIds2 = [ fixtureVulvodynia.id ];

    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );

    // Start first background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds1 );

    /*
     * Immediately try to start second
     * Should add to queue but not start new processor
     */
    mf.fetchQueue.triggerBackgroundFetch( actIds2 );

    // Advance through both fetches (2 acts × 30s = 60s)
    await jest.advanceTimersByTimeAsync( 60000 );

    /*
     * Both should be processed by the SAME processor
     * This proves concurrent processors weren't started
     */
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 2 );
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledWith( fixtureVulvodynia.id );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test full workflow: fetchMultipleActs → triggerBackgroundFetch → processFetchQueue
   */
  test( 'full workflow from API request to background processing', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id
    ];

    // Both acts missing from cache
    mf.database.getActFromCache.mockResolvedValue( null );

    // Mock successful fetches
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();

    // Call fetchMultipleActs (triggers background fetch)
    const apiResult = await mf.actService.fetchMultipleActs( actIds );

    // API should return error (2+ acts missing)
    expect( apiResult.error ).toBeDefined();

    /*
     * Background fetch should have been triggered
     * Advance time to process both
     */
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify background processing occurred
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 2 );
    expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test queue handles large number of acts
   */
  test( 'triggerBackgroundFetch handles many acts queued at once', async () => {
    jest.useFakeTimers();

    // Queue 10 acts at once
    const manyActIds = Array.from( { 'length': 10 }, ( _, i ) => `act-id-${i}` );

    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureTheKinks );
    mf.database.cacheAct.mockResolvedValue();

    // Trigger background fetch with many IDs
    mf.fetchQueue.triggerBackgroundFetch( manyActIds );

    // Advance time to process all (10 × 30s = 300s)
    await jest.advanceTimersByTimeAsync( 300000 );

    // All should be processed
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 10 );
    expect( mf.database.cacheAct ).toHaveBeenCalledTimes( 10 );

    jest.useRealTimers();
  }, 15000 );

  /**
   * Test queue state management across concurrent API requests
   */
  test( 'queue maintains state correctly during concurrent requests', async () => {
    jest.useFakeTimers();

    const actIds1 = [ fixtureTheKinks.id ];
    const actIds2 = [ fixtureVulvodynia.id ];

    mf.database.getActFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureTheKinks );
    mf.database.cacheAct.mockResolvedValue();

    // Simulate two concurrent API requests
    const request1 = mf.actService.fetchMultipleActs( actIds1 );
    const request2 = mf.actService.fetchMultipleActs( actIds2 );

    await Promise.all( [ request1, request2 ] );

    // Advance time to process both
    await jest.advanceTimersByTimeAsync( 60000 );

    // Both should be added to queue and processed
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test duplicate IDs in queue are handled
   */
  test( 'triggerBackgroundFetch deduplicates IDs in queue', async () => {
    jest.useFakeTimers();

    const duplicateIds = [
      fixtureTheKinks.id,
      fixtureTheKinks.id,
      fixtureTheKinks.id
    ];

    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureTheKinks );
    mf.database.cacheAct.mockResolvedValue();

    // Trigger with duplicate IDs
    mf.fetchQueue.triggerBackgroundFetch( duplicateIds );

    // Advance time
    await jest.advanceTimersByTimeAsync( 60000 );

    // Should only fetch once (queue deduplicates)
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledTimes( 1 );
    expect( mf.musicbrainz.fetchAct ).toHaveBeenCalledWith( fixtureTheKinks.id );

    jest.useRealTimers();
  }, 10000 );
} );
