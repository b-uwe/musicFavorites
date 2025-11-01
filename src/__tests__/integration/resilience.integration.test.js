/**
 * Integration tests for database connection resilience
 * Tests: Connection recovery, failover, transaction handling
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/resilience.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external I/O BEFORE requiring modules

const { MongoClient } = require( 'mongodb' );

// Load integration test setup helper
require( '../../testHelpers/integrationTestSetup' );

// Load all real business logic modules AFTER mocks
require( '../../testHelpers/fixtureHelpers' );
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Database Connection Resilience Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    const setup = await mf.testing.integrationTestSetup.setupIntegrationTest();

    ( { mockCollection } = setup );

    // Mock fetchQueue to prevent background processing
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test connection drops mid-request and recovers
   */
  test( 'connection drops during read and recovers on retry', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // First call fails (connection dropped), second succeeds at MongoDB driver level
    mockCollection.findOne.
      mockRejectedValueOnce( new Error( 'Connection lost' ) ).
      mockResolvedValueOnce( cachedData );

    // First request fails
    await expect( request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ) ).
      resolves.toMatchObject( {
        'status': 500
      } );

    // Second request succeeds (connection recovered)
    const response2 = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response2.body.acts ).toHaveLength( 1 );
  } );

  /**
   * Test cache write failure doesn't block read operations
   */
  test( 'cache write failures do not block read operations', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // Read succeeds but write fails at MongoDB driver level
    mockCollection.findOne.mockResolvedValue( cachedData );
    mockCollection.updateOne.mockRejectedValue( new Error( 'Write failed' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  } );

  /**
   * Test intermittent connection failures
   */
  test( 'intermittent connection failures are handled gracefully', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // Alternate between success and failure at MongoDB driver level
    mockCollection.findOne.
      mockResolvedValueOnce( cachedData ).
      mockRejectedValueOnce( new Error( 'Connection timeout' ) ).
      mockResolvedValueOnce( cachedData ).
      mockRejectedValueOnce( new Error( 'Connection timeout' ) ).
      mockResolvedValueOnce( cachedData );

    // Make 5 requests
    const responses = await Promise.all( [
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` )
    ] );

    // Some succeed, some fail
    const successCount = responses.filter( ( r ) => r.status === 200 ).length;
    const failureCount = responses.filter( ( r ) => r.status === 500 ).length;

    expect( successCount ).toBe( 3 );
    expect( failureCount ).toBe( 2 );
  } );

  /**
   * Test connection pool exhaustion
   */
  test( 'connection pool exhaustion is handled', async () => {
    const poolError = new Error( 'No connections available in pool' );

    poolError.code = 'POOL_EXHAUSTED';
    // Reject at MongoDB driver level
    mockCollection.findOne.mockRejectedValue( poolError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test network partition scenario
   */
  test( 'network partition between app and database is handled', async () => {
    const networkError = new Error( 'Network unreachable' );

    networkError.code = 'ENETUNREACH';
    // Reject at MongoDB driver level
    mockCollection.findOne.mockRejectedValue( networkError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error ).toBeDefined();
  } );

  /**
   * Test slow database responses (timeout simulation)
   */
  test( 'slow database responses are handled appropriately', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    // Simulate slow response by delaying at MongoDB driver level
    mockCollection.findOne.mockImplementation( () => new Promise( ( resolve ) => {
      setTimeout( () => {
        resolve( cachedData );
      }, 100 );
    } ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  }, 10000 );

  /**
   * Test concurrent connection failures
   */
  test( 'concurrent connection failures affect all requests', async () => {
    // All fail at MongoDB driver level
    mockCollection.findOne.mockRejectedValue( new Error( 'Database down' ) );

    const responses = await Promise.all( [
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` )
    ] );

    // All should fail
    responses.forEach( ( response ) => {
      expect( response.status ).toBe( 500 );
    } );
  } );

  /**
   * Test cache read succeeds but cache write fails
   */
  test( 'read succeeds when write fails during background update', async () => {
    jest.useFakeTimers();

    // Cached data is old, triggers background refresh
    const now = new Date();
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );
    const staleArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    staleArtist.events = [];
    staleArtist.updatedAt = staleTimestamp.toLocaleString( 'sv-SE', {
      'timeZone': 'Europe/Berlin'
    } );

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( staleArtist );

    // MongoDB read succeeds with stale data
    mockCollection.findOne.mockResolvedValue( cachedData );

    // Axios already mocked in beforeEach for MusicBrainz

    // MongoDB write will fail AFTER initial read
    mockCollection.updateOne.mockResolvedValueOnce( { 'acknowledged': true } ).
      mockRejectedValueOnce( new Error( 'Write failed' ) );

    // Request should succeed with stale data
    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );

    // Background update attempts but write fails
    await jest.advanceTimersByTimeAsync( 35000 );

    // Should have attempted update (at least once, may fail)
    expect( mockCollection.updateOne.mock.calls.length ).toBeGreaterThan( 0 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test database authentication re-authentication
   */
  test( 'authentication failure requires reconnection', async () => {
    const authError = new Error( 'Authentication failed' );

    authError.code = 18;

    // Disconnect to reset state
    await mf.database.disconnect();

    // Mock MongoClient to fail auth on first connect, succeed on second
    let connectAttempts = 0;

    MongoClient.mockImplementation( () => ( {
      'connect': jest.fn().mockImplementation( () => {
        connectAttempts++;
        if ( connectAttempts === 1 ) {
          return Promise.reject( authError );
        }

        return Promise.resolve();
      } ),
      'db': jest.fn().mockReturnValue( {
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } ),
        'collection': jest.fn().mockReturnValue( mockCollection )
      } ),
      'close': jest.fn().mockResolvedValue()
    } ) );

    // First connection fails - database.js wraps the error in a consumer-friendly message
    await expect( mf.database.connect() ).rejects.toThrow( 'DB_011' );

    // Retry succeeds
    await expect( mf.database.connect() ).resolves.not.toThrow();
  } );

  /**
   * Test connection recovery after extended outage
   */
  test( 'system recovers after extended database outage', async () => {
    // Simulate extended outage (5 failed attempts) at MongoDB driver level
    mockCollection.findOne.
      mockRejectedValueOnce( new Error( 'Connection failed' ) ).
      mockRejectedValueOnce( new Error( 'Connection failed' ) ).
      mockRejectedValueOnce( new Error( 'Connection failed' ) ).
      mockRejectedValueOnce( new Error( 'Connection failed' ) ).
      mockRejectedValueOnce( new Error( 'Connection failed' ) );

    // 5 failures
    for ( let i = 0; i < 5; i += 1 ) {
      const response = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

      expect( response.status ).toBe( 500 );
    }

    // Then recovery - MongoDB returns data
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    transformedArtist.events = [];

    // MongoDB returns transformed data with _id (not musicbrainzId)
    const cachedData = mf.testing.fixtureHelpers.transformToMongoDbDocument( transformedArtist );

    mockCollection.findOne.mockResolvedValue( cachedData );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  } );
} );
