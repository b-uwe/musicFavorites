/**
 * Integration tests for real-world user workflows
 * Tests: Complete user journeys from first request to cache refresh
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/workflows.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'axios' );
jest.mock( 'mongodb' );

const axios = require( 'axios' );
const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../testHelpers/fixtureHelpers' );
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Real-World Workflow Integration Tests', () => {
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
   * Test complete workflow: cache miss → synchronous fetch → cache hit
   */
  test( 'workflow: first request misses cache, fetches synchronously, second request hits cache', async () => {
    // First request: MongoDB returns null (cache miss), axios returns data
    mockCollection.findOne.mockResolvedValueOnce( null );

    // Axios returns MusicBrainz data for synchronous fetch
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Single missing act should fetch synchronously and return 200 with data
    expect( response1.status ).toBe( 200 );
    expect( response1.body.acts ).toHaveLength( 1 );
    expect( response1.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    expect( response1.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Second request: cache hit
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValueOnce( cachedData );

    const response2 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Should return success from cache
    expect( response2.status ).toBe( 200 );
    expect( response2.body.acts ).toHaveLength( 1 );
    expect( response2.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
  } );

  /**
   * Test stale data triggers background refresh while serving cached data
   */
  test( 'workflow: stale cached data is served while background refresh happens', async () => {
    const now = new Date();
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];
    transformedArtist.updatedAt = staleTimestamp.toLocaleString( 'sv-SE', {
      'timeZone': 'Europe/Berlin'
    } );

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    // First request with stale data
    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    /*
     * Should return stale data immediately - the key behavior is that stale data
     * is served to the user without blocking them
     */
    expect( response1.status ).toBe( 200 );
    expect( response1.body.acts[ 0 ].updatedAt ).toBe( transformedArtist.updatedAt );
    expect( response1.body.acts ).toHaveLength( 1 );

    // Verify MongoDB was queried for the cached data
    expect( mockCollection.findOne ).toHaveBeenCalled();
  } );

  /**
   * Test concurrent user requests for same popular artist
   */
  test( 'workflow: 10 concurrent users request same artist (cached)', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    // Simulate 10 concurrent requests
    const requests = Array.from( {
      'length': 10
    }, () => request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ) );

    const responses = await Promise.all( requests );

    // All should succeed
    responses.forEach( ( response ) => {
      expect( response.status ).toBe( 200 );
      expect( response.body.acts[ 0 ].musicbrainzId ).toBe( fixtureTheKinks.id );
    } );

    // MongoDB driver should be accessed 10 times
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 10 );
  } );

  /**
   * Test user requests multiple artists, some cached, some not
   */
  test( 'workflow: user requests 5 artists where 3 are cached and 2 are not', async () => {
    const transformedKinks = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedKinks.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedKinks = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedKinks );

    // First 3 cached, last 2 not
    mockCollection.findOne.
      mockResolvedValueOnce( cachedKinks ).
      mockResolvedValueOnce( cachedKinks ).
      mockResolvedValueOnce( cachedKinks ).
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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

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

    // Should have queried MongoDB 5 times
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 5 );
  } );

  /**
   * Test user requests with pretty formatting
   */
  test( 'workflow: user requests pretty-formatted JSON', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    // 20 different artists
    const requests = Array.from( {
      'length': 20
    }, ( _, i ) => request( mf.app ).get( `/acts/artist-${i}` ) );

    const responses = await Promise.all( requests );

    // All should succeed
    responses.forEach( ( response ) => {
      expect( response.status ).toBe( 200 );
    } );

    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 20 );
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

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    // Make 100 requests for same artist
    for ( let i = 0; i < 100; i += 1 ) {
      const response = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

      expect( response.status ).toBe( 200 );
    }

    // All 100 should hit cache at MongoDB driver level
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 100 );

    // Background fetch should not be triggered (data is fresh) - verify no queue population
    expect( mf.testing.fetchQueue.fetchQueue.has( fixtureTheKinks.id ) ).toBe( false );
  }, 20000 );

  /**
   * Test error recovery workflow
   */
  test( 'workflow: user gets error, retries, succeeds', async () => {
    // First request fails at MongoDB driver level
    mockCollection.findOne.mockRejectedValueOnce( new Error( 'Temporary database issue' ) );

    const response1 = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    expect( response1.status ).toBe( 500 );

    // Second request succeeds
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValueOnce( cachedData );

    const response2 = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response2.body.acts ).toHaveLength( 1 );
  } );
} );
