/**
 * Integration tests for cache updater functionality
 * Tests: cacheUpdater → artistService → database workflow
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/cacheUpdater.integration
 */

const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load all modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/artistService' );
require( '../../services/cacheUpdater' );

describe( 'Cache Updater Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock database functions
    mf.database.getAllActsWithMetadata = jest.fn();
    mf.database.cacheArtist = jest.fn();

    // Mock external HTTP calls
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  /**
   * Test updateAct workflow: fetch from MusicBrainz → enrich → cache
   */
  test( 'updateAct fetches artist data and caches it through full workflow', async () => {
    // Mock successful MusicBrainz fetch
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Call updateAct
    await mf.cacheUpdater.updateAct( fixtureTheKinks.id );

    // Verify full workflow executed
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    // LD+JSON extraction happens conditionally based on Bandsintown relation
    expect( mf.database.cacheArtist ).toHaveBeenCalledWith( expect.objectContaining( {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': expect.any( String )
    } ) );
  } );

  /**
   * Test that errors in the workflow are caught and don't crash
   */
  test( 'updateAct handles errors gracefully without throwing', async () => {
    mf.musicbrainz.fetchArtist.mockRejectedValue( new Error( 'MusicBrainz API error' ) );

    // Should not throw
    await expect( mf.cacheUpdater.updateAct( 'some-id' ) ).resolves.not.toThrow();

    // Should not attempt to cache when fetch fails
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test runSequentialUpdate processes stale acts
   */
  test( 'runSequentialUpdate processes stale acts through full workflow', async () => {
    const yesterday = new Date( Date.now() - ( ( 25 * 60 * 60 ) * 1000 ) );
    const yesterdayString = yesterday.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock one stale act in cache
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': fixtureTheKinks.id,
        'updatedAt': yesterdayString
      }
    ] );

    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Start the update (will process async)
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time to let update complete (30s between updates)
    await jest.advanceTimersByTimeAsync( 35000 );

    const actsUpdated = await updatePromise;

    // Verify workflow executed
    expect( actsUpdated ).toBe( 1 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.database.cacheArtist ).toHaveBeenCalled();
  } );

  /**
   * Test runSequentialUpdate skips fresh acts
   */
  test( 'runSequentialUpdate skips fresh acts (< 24h old)', async () => {
    const now = new Date();
    const nowString = now.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock one fresh act
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': fixtureTheKinks.id,
        'updatedAt': nowString
      }
    ] );

    const actsUpdated = await mf.cacheUpdater.runSequentialUpdate();

    // Should skip fresh act
    expect( actsUpdated ).toBe( 0 );
    expect( mf.musicbrainz.fetchArtist ).not.toHaveBeenCalled();
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test that errors during update don't stop the entire process
   */
  test( 'runSequentialUpdate continues after error in single act update', async () => {
    const yesterday = new Date( Date.now() - ( ( 25 * 60 * 60 ) * 1000 ) );
    const yesterdayString = yesterday.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock two stale acts
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': 'act1',
        'updatedAt': yesterdayString
      },
      {
        '_id': 'act2',
        'updatedAt': yesterdayString
      }
    ] );

    // First act fails, second succeeds
    mf.musicbrainz.fetchArtist.
      mockRejectedValueOnce( new Error( 'Fetch failed for act1' ) ).
      mockResolvedValueOnce( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Start the update
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time to let both updates complete (60s total)
    await jest.advanceTimersByTimeAsync( 70000 );

    const actsUpdated = await updatePromise;

    // Should process both acts
    expect( actsUpdated ).toBe( 2 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
    // But only cache the successful one
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 1 );
  } );

  /**
   * Test runSequentialUpdate with mix of fresh and stale acts
   */
  test( 'runSequentialUpdate only processes stale acts in mixed cache', async () => {
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock mix of fresh and stale acts
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': 'fresh-act',
        'updatedAt': freshTimestamp
      },
      {
        '_id': fixtureTheKinks.id,
        'updatedAt': staleTimestamp
      }
    ] );

    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Start update
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time for one update
    await jest.advanceTimersByTimeAsync( 35000 );

    const actsUpdated = await updatePromise;

    // Should only process stale act
    expect( actsUpdated ).toBe( 1 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 1 );
  } );

  /**
   * Test runSequentialUpdate respects 30s delay between updates
   */
  test( 'runSequentialUpdate waits 30 seconds between each act update', async () => {
    const staleTimestamp = new Date( Date.now() - ( 25 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock three stale acts
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': 'act1',
        'updatedAt': staleTimestamp
      },
      {
        '_id': 'act2',
        'updatedAt': staleTimestamp
      },
      {
        '_id': 'act3',
        'updatedAt': staleTimestamp
      }
    ] );

    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    mf.database.cacheArtist.mockResolvedValue();

    // Start update (don't await yet)
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance through all three updates (3 * 30s = 90s)
    await jest.advanceTimersByTimeAsync( 95000 );

    const actsUpdated = await updatePromise;

    // All three should be processed
    expect( actsUpdated ).toBe( 3 );
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 3 );
    expect( mf.database.cacheArtist ).toHaveBeenCalledTimes( 3 );
  } );
} );
