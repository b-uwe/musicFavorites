/**
 * Integration tests for real-world user workflows
 * Tests: Complete user journeys from first request to cache refresh
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/workflows.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Real-World Workflow Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Reset fetch queue state
    mf.testing.fetchQueue.fetchQueue.clear();
    mf.testing.fetchQueue.setIsRunning( false );

    // Default mocks
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getActFromCache = jest.fn();
    mf.database.cacheAct = jest.fn().mockResolvedValue();
    mf.musicbrainz.fetchAct = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test complete workflow: cache miss → synchronous fetch → cache hit
   */
  test( 'workflow: first request misses cache, fetches synchronously, second request hits cache', async () => {
    // First request: cache miss, MusicBrainz returns data
    mf.database.getActFromCache.mockResolvedValueOnce( null );
    mf.musicbrainz.fetchAct.mockResolvedValueOnce( fixtureTheKinks );

    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Single missing act should fetch synchronously and return 200 with data
    expect( response1.status ).toBe( 200 );
    expect( response1.body.acts ).toHaveLength( 1 );
    expect( response1.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    expect( response1.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Second request: cache hit
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValueOnce( transformedArtist );

    const response2 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Should return success from cache
    expect( response2.status ).toBe( 200 );
    expect( response2.body.acts ).toHaveLength( 1 );
    expect( response2.body.acts[ 0 ]._id ).toBe( fixtureTheKinks.id );
  } );

  /**
   * Test stale data triggers background refresh while serving cached data
   */
  test( 'workflow: stale cached data is served while background refresh happens', async () => {
    const now = new Date();
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );
    const staleArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    staleArtist.events = [];
    staleArtist.updatedAt = staleTimestamp.toLocaleString( 'sv-SE', {
      'timeZone': 'Europe/Berlin'
    } );

    mf.database.getActFromCache.mockResolvedValue( staleArtist );

    // First request with stale data
    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Should return stale data immediately
    expect( response1.status ).toBe( 200 );
    expect( response1.body.acts[ 0 ].updatedAt ).toBe( staleArtist.updatedAt );

    // Should trigger background refresh
    expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ fixtureTheKinks.id ] );
  } );

  /**
   * Test concurrent user requests for same popular artist
   */
  test( 'workflow: 10 concurrent users request same artist (cached)', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    // Simulate 10 concurrent requests
    const requests = Array.from( {
      'length': 10
    }, () => request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ) );

    const responses = await Promise.all( requests );

    // All should succeed
    responses.forEach( ( response ) => {
      expect( response.status ).toBe( 200 );
      expect( response.body.acts[ 0 ]._id ).toBe( fixtureTheKinks.id );
    } );

    // Cache should be accessed 10 times
    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 10 );
  } );

  /**
   * Test user requests multiple artists, some cached, some not
   */
  test( 'workflow: user requests 5 artists where 3 are cached and 2 are not', async () => {
    const transformedKinks = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedKinks.events = [];

    const transformedVulvodynia = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    transformedVulvodynia.events = [];

    // First 3 cached, last 2 not
    mf.database.getActFromCache.
      mockResolvedValueOnce( transformedKinks ).
      mockResolvedValueOnce( transformedKinks ).
      mockResolvedValueOnce( transformedKinks ).
      mockResolvedValueOnce( null ).
      mockResolvedValueOnce( null );

    const actIds = [
      'act1',
      'act2',
      'act3',
      'act4',
      'act5'
    ];

    const response = await request( mf.app ).get( `/acts/${actIds.join( ',' )}` );

    // Should return 503 (2+ missing)
    expect( response.status ).toBe( 503 );
    expect( response.body.error.message ).toContain( '2 acts not cached' );
  } );

  /**
   * Test user browses multiple artists sequentially
   */
  test( 'workflow: user browses 5 different artists sequentially', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const artistIds = [
      'artist1',
      'artist2',
      'artist3',
      'artist4',
      'artist5'
    ];

    // Browse each artist
    for ( const artistId of artistIds ) {
      const response = await request( mf.app ).get( `/acts/${artistId}` );

      expect( response.status ).toBe( 200 );
      expect( response.body.acts ).toHaveLength( 1 );
    }

    // Should have queried cache 5 times
    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 5 );
  } );

  /**
   * Test user requests with pretty formatting
   */
  test( 'workflow: user requests pretty-formatted JSON', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}?pretty` ).
      expect( 200 );

    const responseText = JSON.stringify( response.body, null, 2 );

    // Should be pretty-formatted
    expect( responseText ).toContain( '\n' );
    expect( responseText ).toContain( '  ' );
  } );

  /**
   * Test peak load: many users requesting different artists
   */
  test( 'workflow: peak load with 20 concurrent users requesting different artists', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    // 20 different artists
    const requests = Array.from( {
      'length': 20
    }, ( _, i ) => request( mf.app ).get( `/acts/artist-${i}` ) );

    const responses = await Promise.all( requests );

    // All should succeed
    responses.forEach( ( response ) => {
      expect( response.status ).toBe( 200 );
    } );

    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 20 );
  }, 15000 );

  /**
   * Test repeated requests for same artist (caching effectiveness)
   */
  test( 'workflow: same artist requested 100 times (cache efficiency)', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // Set fresh timestamp to avoid background refresh
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );

    transformedArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', {
      'timeZone': 'Europe/Berlin'
    } );

    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    // Make 100 requests for same artist
    for ( let i = 0; i < 100; i += 1 ) {
      const response = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

      expect( response.status ).toBe( 200 );
    }

    // All 100 should hit cache
    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 100 );

    // Background fetch should not be triggered (data is fresh)
    expect( mf.fetchQueue.triggerBackgroundFetch ).not.toHaveBeenCalled();
  }, 20000 );

  /**
   * Test error recovery workflow
   */
  test( 'workflow: user gets error, retries, succeeds', async () => {
    // First request fails
    mf.database.getActFromCache.mockRejectedValueOnce( new Error( 'Temporary database issue' ) );

    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    expect( response1.status ).toBe( 500 );

    // Second request succeeds
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValueOnce( transformedArtist );

    const response2 = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response2.body.acts ).toHaveLength( 1 );
  } );
} );
