/**
 * Integration tests for cache updater functionality
 * Tests: cacheUpdater → actService → database workflow
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/cacheUpdater.integration
 */

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
require( '../../services/actService' );
require( '../../services/cacheUpdater' );

describe( 'Cache Updater Integration Tests', () => {
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
   * Test updateAct workflow: fetch from MusicBrainz → enrich → cache
   */
  test( 'updateAct fetches act data and caches it through full workflow', async () => {
    // Call updateAct
    await mf.cacheUpdater.updateAct( fixtureTheKinks.id );

    // Verify full workflow executed - axios for MusicBrainz HTTP call
    expect( axios.get ).toHaveBeenCalledWith(
      expect.stringContaining( fixtureTheKinks.id ),
      expect.any( Object )
    );
    // Verify MongoDB cache write occurred
    expect( mockCollection.updateOne ).toHaveBeenCalledWith(
      expect.objectContaining( { '_id': fixtureTheKinks.id } ),
      expect.any( Object ),
      expect.any( Object )
    );
  } );

  /**
   * Test that errors in the workflow are caught and don't crash
   */
  test( 'updateAct handles errors gracefully without throwing', async () => {
    // Mock axios to reject for MusicBrainz API error
    axios.get.mockRejectedValue( new Error( 'MusicBrainz API error' ) );

    // Should not throw
    await expect( mf.cacheUpdater.updateAct( 'some-id' ) ).resolves.not.toThrow();

    // Should not attempt to cache when fetch fails
    expect( mockCollection.updateOne ).not.toHaveBeenCalled();
  } );

  /**
   * Test runSequentialUpdate processes stale acts
   */
  test( 'runSequentialUpdate processes stale acts through full workflow', async () => {
    const yesterday = new Date( Date.now() - ( ( 25 * 60 * 60 ) * 1000 ) );
    const yesterdayString = yesterday.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock MongoDB to return one stale act
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [
        {
          '_id': fixtureTheKinks.id,
          'updatedAt': yesterdayString
        }
      ] )
    } );

    // Start the update (will process async)
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time to let update complete (30s between updates)
    await jest.advanceTimersByTimeAsync( 35000 );

    const actsUpdated = await updatePromise;

    // Verify workflow executed
    expect( actsUpdated ).toBe( 1 );
    // Verify axios was called for MusicBrainz
    expect( axios.get ).toHaveBeenCalledWith(
      expect.stringContaining( fixtureTheKinks.id ),
      expect.any( Object )
    );
    // Verify MongoDB cache write
    expect( mockCollection.updateOne ).toHaveBeenCalled();
  } );

  /**
   * Test runSequentialUpdate skips fresh acts
   */
  test( 'runSequentialUpdate skips fresh acts (< 24h old)', async () => {
    const now = new Date();
    const nowString = now.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock MongoDB to return one fresh act
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [
        {
          '_id': fixtureTheKinks.id,
          'updatedAt': nowString
        }
      ] )
    } );

    const actsUpdated = await mf.cacheUpdater.runSequentialUpdate();

    // Should skip fresh act
    expect( actsUpdated ).toBe( 0 );
    // No HTTP calls should be made
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 0 );
    // No cache writes beyond the initial connection setup
    expect( mockCollection.updateOne ).not.toHaveBeenCalled();
  } );

  /**
   * Test that errors during update don't stop the entire process
   */
  test( 'runSequentialUpdate continues after error in single act update', async () => {
    const yesterday = new Date( Date.now() - ( ( 25 * 60 * 60 ) * 1000 ) );
    const yesterdayString = yesterday.toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock MongoDB to return two stale acts
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [
        {
          '_id': 'act1',
          'updatedAt': yesterdayString
        },
        {
          '_id': 'act2',
          'updatedAt': yesterdayString
        }
      ] )
    } );

    // First act fails, second succeeds at axios level
    let callCount = 0;

    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        callCount++;
        if ( callCount === 1 ) {
          return Promise.reject( new Error( 'Fetch failed for act1' ) );
        }

        return Promise.resolve( { 'data': fixtureTheKinks } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    // Start the update
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time to let both updates complete (60s total)
    await jest.advanceTimersByTimeAsync( 70000 );

    const actsUpdated = await updatePromise;

    // Should process both acts
    expect( actsUpdated ).toBe( 2 );
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 2 );
    // But only cache the successful one
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 1 );
  } );

  /**
   * Test runSequentialUpdate with mix of fresh and stale acts
   */
  test( 'runSequentialUpdate only processes stale acts in mixed cache', async () => {
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );
    const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock MongoDB to return mix of fresh and stale acts
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [
        {
          '_id': 'fresh-act',
          'updatedAt': freshTimestamp
        },
        {
          '_id': fixtureTheKinks.id,
          'updatedAt': staleTimestamp
        }
      ] )
    } );

    // Start update
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance time for one update
    await jest.advanceTimersByTimeAsync( 35000 );

    const actsUpdated = await updatePromise;

    // Should only process stale act
    expect( actsUpdated ).toBe( 1 );
    // Verify only one HTTP call for the stale act
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 1 );
    expect( musicbrainzCalls[ 0 ][ 0 ] ).toContain( fixtureTheKinks.id );
  } );

  /**
   * Test runSequentialUpdate respects 30s delay between updates
   */
  test( 'runSequentialUpdate waits 30 seconds between each act update', async () => {
    const staleTimestamp = new Date( Date.now() - ( 25 * 60 * 60 * 1000 ) ).toISOString().replace( 'T', ' ' ).substring( 0, 19 );

    // Mock MongoDB to return three stale acts
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [
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
      ] )
    } );

    // Start update (don't await yet)
    const updatePromise = mf.cacheUpdater.runSequentialUpdate();

    // Advance through all three updates (3 * 30s = 90s)
    await jest.advanceTimersByTimeAsync( 95000 );

    const actsUpdated = await updatePromise;

    // All three should be processed
    expect( actsUpdated ).toBe( 3 );
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 3 );
    expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 3 );
  } );
} );
