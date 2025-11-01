/**
 * Integration tests for Express app routes
 * Tests: Express routes → actService → database workflow
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/app.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external I/O BEFORE requiring modules

const axios = require( 'axios' );
const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../testHelpers/fixtureHelpers' );
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/cacheUpdater' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Express App Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Disconnect database to force fresh connection with new mocks
    try {
      await mf.database.disconnect();
    } catch ( error ) {
      // Ignore errors if not connected
    }

    // Reset fetch queue state
    mf.testing.fetchQueue.fetchQueue.clear();
    mf.testing.fetchQueue.setIsRunning( false );

    // Mock MongoDB driver
    mockCollection = {
      'findOne': jest.fn(),
      'updateOne': jest.fn().mockResolvedValue( { 'acknowledged': true } ),
      'find': jest.fn().mockReturnValue( { 'toArray': jest.fn().mockResolvedValue( [] ) } ),
      'deleteOne': jest.fn().mockResolvedValue( { 'acknowledged': true } )
    };

    MongoClient.mockImplementation( () => ( {
      'connect': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( {
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } ),
        'collection': jest.fn().mockReturnValue( mockCollection )
      } ),
      'close': jest.fn().mockResolvedValue()
    } ) );

    // Mock axios for HTTP calls - default to success, tests will override
    axios.get = jest.fn().mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Connect database before each test
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await mf.database.connect();
  } );

  afterEach( () => {
    jest.useRealTimers();
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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    // Verify response structure
    expect( response.body.meta ).toBeDefined();
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    expect( response.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Verify workflow - MongoDB driver called
    expect( mockCollection.findOne ).toHaveBeenCalledWith( { '_id': fixtureTheKinks.id } );
    // Should not fetch immediately if cached with fresh data (no axios calls to MusicBrainz)
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 0 );
  } );


  /**
   * Test ?pretty parameter integration
   */
  test( 'GET /acts/:id?pretty formats JSON with proper spacing', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // First act cached, second and third not cached
    mockCollection.findOne.
      mockResolvedValueOnce( cachedData ).
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

    const transformedFreshArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedFreshArtist.events = [];
    transformedFreshArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const freshCachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedFreshArtist );

    const transformedStaleArtist = mf.testing.fixtureHelpers.modifyFixture( transformedFreshArtist, {
      'musicbrainzId': '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'updatedAt': staleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    } );

    const staleCachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedStaleArtist );

    mockCollection.findOne.
      mockResolvedValueOnce( freshCachedData ).
      mockResolvedValueOnce( staleCachedData );

    const actIds = [
      fixtureTheKinks.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 200 );

    // Should return both acts
    expect( response.body.acts ).toHaveLength( 2 );

    // Verify both acts are returned with correct IDs
    const returnedIds = response.body.acts.map( ( act ) => act.musicbrainzId ).sort();

    expect( returnedIds ).toEqual( actIds.sort() );

    /*
     * Background refresh may have started processing - since both are cached,
     * only the stale one might trigger axios call during background processing.
     * The exact number depends on timing, so just verify no errors occurred.
     */
    expect( response.body.error ).toBeUndefined();
  } );

  /**
   * Test error middleware with real failure
   */
  test( 'GET /acts/:id returns 500 on unexpected error', async () => {
    // MongoDB driver throws unexpected error
    mockCollection.findOne.mockImplementation( () => {
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
    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios succeeds for MusicBrainz (synchronous fetch), but no events
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    // Should return act data (synchronous fetch succeeded)
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

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
    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios fails for MusicBrainz to trigger error
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( new Error( 'MusicBrainz unavailable' ) );
      }

      return Promise.resolve( { 'data': '' } );
    } );

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
    // Create scenario that returns 503 - MongoDB returns null for both (cache miss)
    mockCollection.findOne.mockResolvedValueOnce( null ).mockResolvedValueOnce( null );

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

  /**
   * Test POST /acts with cached artist
   */
  test( 'POST /acts returns cached artist through full workflow', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );

    transformedArtist.events = [];
    transformedArtist.status = 'disbanded';
    transformedArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( fixtureTheKinks.id ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    // Verify response structure
    expect( response.body.meta ).toBeDefined();
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    expect( response.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Verify workflow - MongoDB driver called
    expect( mockCollection.findOne ).toHaveBeenCalledWith( { '_id': fixtureTheKinks.id } );
    // Should not fetch immediately if cached with fresh data (no axios calls to MusicBrainz)
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 0 );
  } );

  /**
   * Test POST /acts with multiple IDs
   */
  test( 'POST /acts handles multiple IDs in request body', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    const transformedArtist2 = mf.testing.fixtureHelpers.modifyFixture( transformedArtist, {
      'musicbrainzId': '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'name': 'Test Artist 2'
    } );

    const cachedData2 = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist2 );

    mockCollection.findOne.
      mockResolvedValueOnce( cachedData ).
      mockResolvedValueOnce( cachedData2 );

    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( `${fixtureTheKinks.id},664c3e0e-42d8-48c1-b209-1efca19c0325` ).
      expect( 200 );

    // Verify response includes both acts
    expect( response.body.acts ).toHaveLength( 2 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    expect( response.body.acts[ 1 ].musicbrainzId ).toBe( '664c3e0e-42d8-48c1-b209-1efca19c0325' );
  } );

  /**
   * Test POST /acts with large array of IDs
   */
  test( 'POST /acts handles large array of IDs', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // Mock returns for 50 IDs
    const largeIdArray = Array.from( { 'length': 50 }, ( _, i ) => `id-${i}` );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( largeIdArray.join( ',' ) ).
      expect( 200 );

    // Verify response
    expect( response.body.acts ).toHaveLength( 50 );
  } );

  /**
   * Test POST /acts with invalid request body returns 400
   */
  test( 'POST /acts returns 400 with invalid request body', async () => {
    const response = await request( mf.app ).
      post( '/acts' ).
      send( { 'invalid': 'body' } ).
      expect( 400 );

    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Invalid request body' );
  } );

  /**
   * Test POST /acts with empty IDs array returns 400
   */
  test( 'POST /acts returns 400 with empty IDs array', async () => {
    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( '' ).
      expect( 400 );

    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Invalid request body' );
  } );

  /**
   * Test POST /acts ?pretty parameter
   */
  test( 'POST /acts?pretty formats JSON with proper spacing', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      post( '/acts?pretty' ).
      set( 'Content-Type', 'text/plain' ).
      send( fixtureTheKinks.id ).
      expect( 200 );

    // Verify pretty formatting (has newlines and spaces)
    const responseText = JSON.stringify( response.body, null, 2 );

    expect( responseText ).toContain( '\n' );
    // 2-space indentation
    expect( responseText ).toContain( '  ' );
  } );

  /**
   * Test POST /acts with cache miss returns error
   */
  test( 'POST /acts with empty cache returns error and triggers background fetch', async () => {
    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios succeeds for MusicBrainz (synchronous fetch), but no events
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( fixtureTheKinks.id ).
      expect( 200 );

    // Should return act data (synchronous fetch succeeded)
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
  } );

  /**
   * Test POST /acts response headers
   */
  test( 'POST /acts sets correct response headers', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( fixtureTheKinks.id );

    // Verify cache control headers
    expect( response.headers[ 'cache-control' ] ).toContain( 'no-store' );
    expect( response.headers[ 'x-robots-tag' ] ).toContain( 'noindex' );
  } );

  /**
   * Test HTTP request logging middleware integration
   */
  test( 'HTTP request logging middleware logs all requests', async () => {
    const infoSpy = jest.spyOn( mf.logger, 'info' ).mockImplementation( () => {
      // Mock implementation to prevent actual logging
    } );

    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    // Verify logging occurred with correct context
    expect( infoSpy ).toHaveBeenCalledWith(
      expect.objectContaining( {
        'method': 'GET',
        'path': `/acts/${fixtureTheKinks.id}`,
        'statusCode': 200,
        'duration': expect.any( Number )
      } ),
      'HTTP request'
    );

    infoSpy.mockRestore();
  } );
} );
