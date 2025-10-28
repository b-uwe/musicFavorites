/**
 * Integration tests for scalability and performance under load
 * Tests: Large batch requests and queue overflow scenarios
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/scalability.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'axios' );
jest.mock( 'mongodb' );

const axios = require( 'axios' );
const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Scalability Integration Tests', () => {
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

    // Mock axios for HTTP calls
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
   * Test handling 200 acts in single request (all cached)
   */
  test( 'GET /acts with 200 cached acts returns successfully', async () => {
    // MongoDB returns cached data for all requests
    const cachedData = {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': 'active',
      'events': []
    };

    mockCollection.findOne.mockResolvedValue( cachedData );

    // Generate 200 act IDs
    const actIds = Array.from( {
      'length': 200
    }, ( _, i ) => `act-id-${i}` );

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 200 );

    // Should return all 200 acts
    expect( response.body.acts ).toHaveLength( 200 );
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 200 );
  }, 15000 );

  /**
   * Test handling 200 acts with partial cache misses
   */
  test( 'GET /acts with 200 acts where 50 are missing returns error', async () => {
    const cachedData = {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': 'active',
      'events': []
    };

    let callCount = 0;

    // First 150 cached, last 50 missing at MongoDB driver level
    mockCollection.findOne.mockImplementation( () => {
      callCount += 1;

      if ( callCount <= 150 ) {
        return Promise.resolve( cachedData );
      }

      return Promise.resolve( null );
    } );

    const actIds = Array.from( {
      'length': 200
    }, ( _, i ) => `act-id-${i}` );

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 503 );

    // Should error about missing acts
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toContain( '50 acts not cached' );
  }, 15000 );

  /**
   * Test queue overflow with 500+ acts queued at once
   */
  test( 'background fetch queue handles 500 acts without crashing', async () => {
    const actIds = Array.from( {
      'length': 500
    }, ( _, i ) => `act-id-${i}` );

    /*
     * Axios mocked in beforeEach to return fixtureTheKinks for MusicBrainz
     * MongoDB updateOne mocked in beforeEach to succeed
     * Trigger background fetch with 500 acts
     */
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Should not crash, queue size should be close to 500 (some may have started processing)
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBeGreaterThan( 490 );

    // Advance enough time to process some (not all)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Should have started processing via axios
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBeGreaterThan( 0 );
  }, 20000 );

  /**
   * Test concurrent large batch requests
   */
  test( 'concurrent requests for 100 acts each are handled', async () => {
    const cachedData = {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': 'active',
      'events': []
    };

    mockCollection.findOne.mockResolvedValue( cachedData );

    const batch1 = Array.from( {
      'length': 100
    }, ( _, i ) => `batch1-id-${i}` );
    const batch2 = Array.from( {
      'length': 100
    }, ( _, i ) => `batch2-id-${i}` );

    const [ response1, response2 ] = await Promise.all( [
      request( mf.app ).get( `/acts/${batch1.join( ',' )}` ),
      request( mf.app ).get( `/acts/${batch2.join( ',' )}` )
    ] );

    // Both should succeed
    expect( response1.status ).toBe( 200 );
    expect( response2.status ).toBe( 200 );
    expect( response1.body.acts ).toHaveLength( 100 );
    expect( response2.body.acts ).toHaveLength( 100 );
  }, 20000 );

  /**
   * Test memory efficiency with large batches
   */
  test( 'large batch request does not cause memory issues', async () => {
    const cachedData = {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': 'active',
      'events': []
    };

    mockCollection.findOne.mockResolvedValue( cachedData );

    const actIds = Array.from( {
      'length': 300
    }, ( _, i ) => `act-id-${i}` );

    // Measure memory before (rough approximation)
    const memBefore = process.memoryUsage().heapUsed;

    await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 200 );

    const memAfter = process.memoryUsage().heapUsed;
    const memDelta = memAfter - memBefore;

    // Memory increase should be reasonable (< 100MB for 300 acts)
    expect( memDelta ).toBeLessThan( 100 * 1024 * 1024 );
  }, 20000 );

  /**
   * Test queue respects 30-second delay between fetches
   */
  test( 'queue respects 30-second delay between processing acts', async () => {
    // Axios and MongoDB updateOne mocked in beforeEach

    // Queue 5 acts
    const actIds = Array.from( { 'length': 5 }, ( _, i ) => `act-id-${i}` );

    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Allow time for first fetch to start and complete
    await jest.advanceTimersByTimeAsync( 10 );

    // First act should be processed immediately via axios
    let musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 1 );

    // Fast-forward 15 seconds - second act should NOT be processed yet (needs 30s total)
    await jest.advanceTimersByTimeAsync( 15000 );
    musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );
    expect( musicbrainzCalls.length ).toBe( 1 );

    // Fast-forward another 15 seconds (total 30s + processing time) - second act should now be processed
    await jest.advanceTimersByTimeAsync( 15000 );
    musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );
    expect( musicbrainzCalls.length ).toBe( 2 );

    // Fast-forward 15 seconds - third act should NOT be processed yet
    await jest.advanceTimersByTimeAsync( 15000 );
    musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );
    expect( musicbrainzCalls.length ).toBe( 2 );

    // Fast-forward another 15 seconds (total 30s) - third act should now be processed
    await jest.advanceTimersByTimeAsync( 15000 );
    musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );
    expect( musicbrainzCalls.length ).toBe( 3 );

    /*
     * Verify rate: 3 fetches with ~30-second delays between them
     * Timeline: fetch1 @ 0s, fetch2 @ ~30s, fetch3 @ ~60s
     * This confirms the 30-second delay is correctly enforced
     */
  }, 10000 );

  /**
   * Test queue deduplication with massive duplicates
   */
  test( 'queue deduplicates when same 100 acts requested 10 times', () => {
    const actIds = Array.from( {
      'length': 100
    }, ( _, i ) => `act-id-${i}` );

    // Add same 100 acts 10 times
    for ( let i = 0; i < 10; i += 1 ) {
      mf.fetchQueue.triggerBackgroundFetch( actIds );
    }

    // Queue should only have 100 unique acts
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBe( 100 );
  } );

  /**
   * Test system stability under sustained load
   */
  test( 'system remains stable with 20 sequential large requests', async () => {
    const cachedData = {
      '_id': fixtureTheKinks.id,
      'name': fixtureTheKinks.name,
      'status': 'active',
      'events': []
    };

    mockCollection.findOne.mockResolvedValue( cachedData );

    // Make 20 sequential requests of 50 acts each
    for ( let i = 0; i < 20; i += 1 ) {
      const actIds = Array.from( {
        'length': 50
      }, ( _, j ) => `batch${i}-id-${j}` );

      const response = await request( mf.app ).get( `/acts/${actIds.join( ',' )}` );

      expect( response.status ).toBe( 200 );
      expect( response.body.acts ).toHaveLength( 50 );
    }

    // All requests should have been processed at MongoDB driver level
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 1000 );
  }, 30000 );
} );
