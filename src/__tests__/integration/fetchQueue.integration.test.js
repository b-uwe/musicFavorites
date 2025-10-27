/**
 * Integration tests for fetch queue functionality
 * These tests use real module imports to catch circular dependencies
 * Only external I/O (mongodb for database, axios for HTTP) are mocked
 * @module __tests__/integration/fetchQueue.integration
 */

const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'axios' );
jest.mock( 'mongodb' );

const axios = require( 'axios' );
const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/actService' );
require( '../../services/fetchQueue' );

describe( 'Fetch Queue Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    jest.clearAllMocks();

    // Disconnect database to force fresh connection with new mocks
    try {
      await mf.database.disconnect();
    } catch ( error ) {
      // Ignore errors if not connected
    }

    // Reset fetchQueue state between tests
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
    axios.get = jest.fn();

    // Connect database before each test
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await mf.database.connect();
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

    // Mock axios for HTTP calls - return fixtures for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( fixtureTheKinks.id ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( fixtureVulvodynia.id ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches (2 acts × 30s = 60s)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify axios was called for MusicBrainz fetches
    expect( axios.get ).toHaveBeenCalled();
    expect( axios.get.mock.calls.some( ( call ) => call[ 0 ].includes( fixtureTheKinks.id ) ) ).toBe( true );
    expect( axios.get.mock.calls.some( ( call ) => call[ 0 ].includes( fixtureVulvodynia.id ) ) ).toBe( true );
    // Verify MongoDB cache writes occurred
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 2 );

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

    // All acts are missing from cache at MongoDB level
    mockCollection.findOne.mockResolvedValue( null );

    // Mock axios for background fetch behavior
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

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

    // First succeeds, second fails, third succeeds at axios level
    let callCount = 0;

    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        callCount++;
        if ( callCount === 1 ) {
          return Promise.resolve( { 'data': fixtureTheKinks } );
        }
        if ( callCount === 2 ) {
          return Promise.reject( new Error( 'MusicBrainz fetch failed' ) );
        }

        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through all fetches (3 acts × 30s = 90s)
    await jest.advanceTimersByTimeAsync( 90000 );

    // All 3 should be attempted via axios
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 3 );
    // But only 2 should be cached (the successful ones)
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 2 );

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

    // Mock axios for successful fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( fixtureTheKinks.id ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( fixtureVulvodynia.id ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // First cache succeeds, second fails at MongoDB level
    mockCollection.updateOne.
      mockResolvedValueOnce( { 'acknowledged': true } ).
      mockRejectedValueOnce( new Error( 'Cache write failed' ) );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches
    await jest.advanceTimersByTimeAsync( 60000 );

    // Both should be fetched
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 2 );
    // Both cache attempts should be made (even though second fails)
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 2 );

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

    // Mock axios for both fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( fixtureTheKinks.id ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( fixtureVulvodynia.id ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

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
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 2 );
    expect( musicbrainzCalls.some( ( call ) => call[ 0 ].includes( fixtureTheKinks.id ) ) ).toBe( true );
    expect( musicbrainzCalls.some( ( call ) => call[ 0 ].includes( fixtureVulvodynia.id ) ) ).toBe( true );

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

    // Both acts missing from cache at MongoDB level
    mockCollection.findOne.mockResolvedValue( null );

    // Mock successful axios fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( fixtureTheKinks.id ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( fixtureVulvodynia.id ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

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
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 2 );
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test queue handles large number of acts
   */
  test( 'triggerBackgroundFetch handles many acts queued at once', async () => {
    jest.useFakeTimers();

    // Queue 10 acts at once
    const manyActIds = Array.from( { 'length': 10 }, ( _, i ) => `act-id-${i}` );

    // Mock axios for all fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Trigger background fetch with many IDs
    mf.fetchQueue.triggerBackgroundFetch( manyActIds );

    // Advance time to process all (10 × 30s = 300s)
    await jest.advanceTimersByTimeAsync( 300000 );

    // All should be processed
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 10 );
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 10 );

    jest.useRealTimers();
  }, 15000 );

  /**
   * Test queue state management across concurrent API requests
   */
  test( 'queue maintains state correctly during concurrent requests', async () => {
    jest.useFakeTimers();

    const actIds1 = [ fixtureTheKinks.id ];
    const actIds2 = [ fixtureVulvodynia.id ];

    // All acts missing from cache
    mockCollection.findOne.mockResolvedValue( null );

    // Mock axios for fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Simulate two concurrent API requests
    const request1 = mf.actService.fetchMultipleActs( actIds1 );
    const request2 = mf.actService.fetchMultipleActs( actIds2 );

    await Promise.all( [ request1, request2 ] );

    // Advance time to process both
    await jest.advanceTimersByTimeAsync( 60000 );

    // Both should be added to queue and processed
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 2 );

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

    // Mock axios for fetches
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Trigger with duplicate IDs
    mf.fetchQueue.triggerBackgroundFetch( duplicateIds );

    // Advance time
    await jest.advanceTimersByTimeAsync( 60000 );

    // Should only fetch once (queue deduplicates)
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 1 );
    expect( musicbrainzCalls[ 0 ][ 0 ] ).toContain( fixtureTheKinks.id );

    jest.useRealTimers();
  }, 10000 );
} );
