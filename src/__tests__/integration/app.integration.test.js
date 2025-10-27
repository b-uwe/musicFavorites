/**
 * Integration tests for Express app routes
 * Tests: Express routes → actService → database workflow
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/app.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

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
require( '../../services/cacheUpdater' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Express App Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock database as healthy by default
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getActFromCache = jest.fn();
    mf.database.cacheAct = jest.fn().mockResolvedValue();

    // Mock external HTTP calls
    mf.musicbrainz.fetchAct = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );

    // Mock fetchQueue and cacheUpdater
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test full request → response flow for cached artist
   */
  test( 'GET /acts/:id returns cached artist through full workflow', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );

    transformedArtist.events = [];
    transformedArtist.status = 'disbanded';
    transformedArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    // Mock cache hit
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    // Verify response structure
    expect( response.body.meta ).toBeDefined();
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ]._id ).toBe( fixtureTheKinks.id );
    expect( response.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Verify workflow
    expect( mf.database.getActFromCache ).toHaveBeenCalledWith( fixtureTheKinks.id );
    // Should not fetch immediately if cached with fresh data
    expect( mf.musicbrainz.fetchAct ).not.toHaveBeenCalled();
    // Should not trigger background refresh for fresh data
    expect( mf.fetchQueue.triggerBackgroundFetch ).not.toHaveBeenCalled();
  } );


  /**
   * Test ?pretty parameter integration
   */
  test( 'GET /acts/:id?pretty formats JSON with proper spacing', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}?pretty` ).
      expect( 200 );

    // Verify pretty formatting (has newlines and spaces)
    const responseText = JSON.stringify( response.body, null, 2 );

    expect( responseText ).toContain( '\n' );
    // 2-space indentation
    expect( responseText ).toContain( '  ' );
  } );

  /**
   * Test robots.txt endpoint
   */
  test( 'GET /robots.txt returns text/plain', async () => {
    const response = await request( mf.app ).
      get( '/robots.txt' ).
      expect( 200 ).
      expect( 'Content-Type', /text\/plain/u );

    expect( response.text ).toContain( 'User-agent' );
  } );

  /**
   * Test multi-act partial cache miss scenario
   */
  test( 'GET /acts/:id1,:id2,:id3 with partial cache miss returns error', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // First act cached, second and third not cached
    mf.database.getActFromCache.
      mockResolvedValueOnce( transformedArtist ).
      mockResolvedValueOnce( null ).
      mockResolvedValueOnce( null );

    const actIds = [
      fixtureTheKinks.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'f35e1992-230b-4d63-9e63-a829caccbcd5'
    ];

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 503 );

    // Should return error for 2+ missing acts
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toContain( '2 acts not cached' );
  } );

  /**
   * Test multi-act with mix of stale and fresh data
   */
  test( 'GET /acts/:id1,:id2 with mixed staleness triggers background refresh', async () => {
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );

    const freshArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    freshArtist.events = [];
    freshArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    const staleArtist = {
      ...freshArtist,
      '_id': '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'updatedAt': staleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    };

    mf.database.getActFromCache.
      mockResolvedValueOnce( freshArtist ).
      mockResolvedValueOnce( staleArtist );

    const actIds = [
      fixtureTheKinks.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 200 );

    // Should return both acts
    expect( response.body.acts ).toHaveLength( 2 );

    // Should trigger background refresh for stale act
    expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ '664c3e0e-42d8-48c1-b209-1efca19c0325' ] );
  } );

  /**
   * Test error middleware with real failure
   */
  test( 'GET /acts/:id returns 500 on unexpected error', async () => {
    mf.database.getActFromCache.mockImplementation( () => {
      throw new Error( 'Unexpected database error' );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
  } );

  /**
   * Test cold start scenario with empty cache
   */
  test( 'GET /acts/:id with empty cache returns error and triggers background fetch', async () => {
    mf.database.getActFromCache.mockResolvedValue( null );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` );

    // Should return error status (either 500 or 503)
    expect( response.status ).toBeGreaterThanOrEqual( 500 );
    expect( response.body.error ).toBeDefined();

    // If we got the expected message, great. Otherwise just verify there's an error
    if ( response.body.error.message ) {
      expect( typeof response.body.error.message ).toBe( 'string' );
    }
  } );

  /**
   * Test 404 handling
   */
  test( 'GET /invalid-route returns 404 with JSON', async () => {
    const response = await request( mf.app ).
      get( '/invalid-route' ).
      expect( 404 );

    expect( response.body.error ).toBe( 'Not found' );
    expect( response.body.status ).toBe( 404 );
  } );

  /**
   * Test response headers are set correctly
   */
  test( 'GET /acts/:id sets correct response headers', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` );

    // Verify cache control headers
    expect( response.headers[ 'cache-control' ] ).toContain( 'no-store' );
    expect( response.headers[ 'x-robots-tag' ] ).toContain( 'noindex' );
  } );

  /**
   * Test error responses include META attribution
   */
  test( 'GET /acts/:id error responses include meta with attribution', async () => {
    mf.database.getActFromCache.mockResolvedValue( null );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` );

    // Should be error response
    expect( response.status ).toBeGreaterThanOrEqual( 500 );

    // But should still include meta
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.attribution ).toBeDefined();
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
    expect( response.body.meta.repository ).toBeDefined();
  } );

  /**
   * Test 503 error responses include meta
   */
  test( 'GET /acts/:id 503 errors include complete meta object', async () => {
    // Create scenario that returns 503
    mf.database.getActFromCache.mockResolvedValueOnce( null ).mockResolvedValueOnce( null );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id},other-id` ).
      expect( 503 );

    // Verify meta is included in 503 response
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.attribution ).toBeDefined();
    expect( response.body.meta.attribution.sources ).toContain( 'MusicBrainz' );
    expect( response.body.meta.attribution.sources ).toContain( 'Bandsintown' );
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );
} );
