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
 * CRITICAL: Import artistService and fetchQueue AFTER mocks are set up
 * This allows us to test real module interactions while mocking external I/O
 */
require( '../../services/artistService' );
require( '../../services/fetchQueue' );

describe( 'Fetch Queue Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Reset fetchQueue state between tests
    mf.testing.fetchQueue.resetForTesting();

    // Mock only the database functions used in these tests
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn();

    // Mock musicbrainz functions
    mf.musicbrainz.fetchArtist = jest.fn();

    // Mock ldJsonExtractor - CRITICAL for background fetch to work
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test that triggerBackgroundFetch can call fetchAndEnrichArtistData without circular dependency errors
   */
  test( 'triggerBackgroundFetch calls fetchAndEnrichArtistData without errors', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id
    ];

    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches (2 acts × 30s = 60s)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify fetchAndEnrichArtistData was called (indirectly through processFetchQueue)
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureVulvodynia.id );
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test that fetchMultipleActs can trigger triggerBackgroundFetch for background fetching
   */
  test( 'fetchMultipleActs triggers background fetch via triggerBackgroundFetch', async () => {
    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    // All acts are missing from cache
    mf.database.getArtistFromCache.mockResolvedValue( null );

    // Mock the background fetch behavior
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Call fetchMultipleActs with 3 missing acts
    const result = await mf.artistService.fetchMultipleActs( actIds );

    // Should return error because 2+ acts are missing
    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( '3 acts not cached' );

    // Verify triggerBackgroundFetch function exists
    expect( typeof mf.fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
  } );

  /**
   * Test that the integration doesn't have circular dependency issues
   */
  test( 'modules load without circular dependency errors', () => {
    // If we got this far, the modules loaded successfully
    expect( mf.artistService ).toBeDefined();
    expect( mf.fetchQueue ).toBeDefined();
    expect( mf.artistService.fetchAndEnrichArtistData ).toBeDefined();
    expect( typeof mf.artistService.fetchAndEnrichArtistData ).toBe( 'function' );
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
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchArtist.mockRejectedValueOnce( new Error( 'MusicBrainz fetch failed' ) );
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through all fetches (3 acts × 30s = 90s)
    await jest.advanceTimersByTimeAsync( 90000 );

    // All 3 should be attempted
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 3 );
    // But only 2 should be cached (the successful ones)
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 2 );

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

    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );

    // First cache succeeds, second fails
    mf.database.cacheArtist.mockResolvedValueOnce();
    mf.database.cacheArtist.mockRejectedValueOnce( new Error( 'Cache write failed' ) );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches
    await jest.advanceTimersByTimeAsync( 60000 );

    // Both should be fetched
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
    // Both cache attempts should be made (even though second fails)
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 2 );

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

    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );

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
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureVulvodynia.id );

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
    mf.database.getArtistFromCache.mockResolvedValue( null );

    // Mock successful fetches
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    mf.musicbrainz.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();

    // Call fetchMultipleActs (triggers background fetch)
    const apiResult = await mf.artistService.fetchMultipleActs( actIds );

    // API should return error (2+ acts missing)
    expect( apiResult.error ).toBeDefined();

    /*
     * Background fetch should have been triggered
     * Advance time to process both
     */
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify background processing occurred
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );
} );
