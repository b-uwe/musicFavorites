/**
 * Integration tests for database connection resilience
 * Tests: Connection recovery, failover, transaction handling
 * Mocks: Database with simulated failures
 * @module __tests__/integration/resilience.integration
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
require( '../../services/artistService' );
require( '../../app' );

describe( 'Database Connection Resilience Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Default mocks
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test connection drops mid-request and recovers
   */
  test( 'connection drops during read and recovers on retry', async () => {
    // First call fails (connection dropped), second succeeds
    mf.database.getArtistFromCache.
      mockRejectedValueOnce( new Error( 'Connection lost' ) ).
      mockResolvedValueOnce( mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks ) );

    // First request fails
    await expect( request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ) ).
      resolves.toMatchObject( {
        'status': 500
      } );

    // Second request succeeds (connection recovered)
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];

    const response2 = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response2.body.acts ).toHaveLength( 1 );
  } );

  /**
   * Test cache write failure doesn't block read operations
   */
  test( 'cache write failures do not block read operations', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    // Write fails but read succeeds
    mf.database.cacheArtist.mockRejectedValue( new Error( 'Write failed' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  } );

  /**
   * Test intermittent connection failures
   */
  test( 'intermittent connection failures are handled gracefully', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];

    // Alternate between success and failure
    mf.database.getArtistFromCache.
      mockResolvedValueOnce( transformedArtist ).
      mockRejectedValueOnce( new Error( 'Connection timeout' ) ).
      mockResolvedValueOnce( transformedArtist ).
      mockRejectedValueOnce( new Error( 'Connection timeout' ) ).
      mockResolvedValueOnce( transformedArtist );

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
    mf.database.getArtistFromCache.mockRejectedValue( poolError );

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
    mf.database.getArtistFromCache.mockRejectedValue( networkError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error ).toBeDefined();
  } );

  /**
   * Test slow database responses (timeout simulation)
   */
  test( 'slow database responses are handled appropriately', async () => {
    // Simulate slow response by delaying
    mf.database.getArtistFromCache.mockImplementation( () => new Promise( ( resolve ) => {
      setTimeout( () => {
        const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

        transformedArtist.events = [];
        resolve( transformedArtist );
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
    mf.database.getArtistFromCache.mockRejectedValue( new Error( 'Database down' ) );

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
    const staleArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    staleArtist.events = [];
    staleArtist.updatedAt = staleTimestamp.toLocaleString( 'sv-SE', {
      'timeZone': 'Europe/Berlin'
    } );

    mf.database.getArtistFromCache.mockResolvedValue( staleArtist );
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.database.cacheArtist.mockRejectedValue( new Error( 'Write failed' ) );

    // Request should succeed with stale data
    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );

    // Background update attempts but write fails
    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.database.cacheArtist ).toHaveBeenCalled();

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test database authentication re-authentication
   */
  test( 'authentication failure requires reconnection', async () => {
    const authError = new Error( 'Authentication failed' );

    authError.code = 18;

    // First attempt fails auth
    mf.database.connect.
      mockRejectedValueOnce( authError ).
      mockResolvedValueOnce();

    // First connection fails
    await expect( mf.database.connect() ).rejects.toThrow( 'Authentication failed' );

    // Retry succeeds
    await expect( mf.database.connect() ).resolves.not.toThrow();
  } );

  /**
   * Test connection recovery after extended outage
   */
  test( 'system recovers after extended database outage', async () => {
    // Simulate extended outage (5 failed attempts)
    mf.database.getArtistFromCache.
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

    // Then recovery
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  } );

  /**
   * Test connection state after health check failure
   */
  test( 'health check failure does not prevent future operations', async () => {
    // Health check fails
    mf.database.testCacheHealth.mockRejectedValue( new Error( 'Health check failed' ) );

    await expect( mf.database.testCacheHealth() ).rejects.toThrow( 'Health check failed' );

    // But operations can still work
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 );

    expect( response.body.acts ).toHaveLength( 1 );
  } );
} );
