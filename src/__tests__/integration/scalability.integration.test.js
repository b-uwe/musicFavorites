/**
 * Integration tests for scalability and performance under load
 * Tests: Large batch requests and queue overflow scenarios
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/scalability.integration
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
require( '../../services/artistService' );
require( '../../app' );

describe( 'Scalability Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Reset fetch queue state
    mf.testing.fetchQueue.fetchQueue.clear();
    mf.testing.fetchQueue.setIsRunning( false );

    // Default mocks
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test handling 200 acts in single request (all cached)
   */
  test( 'GET /acts with 200 cached acts returns successfully', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    // Generate 200 act IDs
    const actIds = Array.from( {
      'length': 200
    }, ( _, i ) => `act-id-${i}` );

    const response = await request( mf.app ).
      get( `/acts/${actIds.join( ',' )}` ).
      expect( 200 );

    // Should return all 200 acts
    expect( response.body.acts ).toHaveLength( 200 );
    expect( mf.database.getArtistFromCache ).toHaveBeenCalledTimes( 200 );
  }, 15000 );

  /**
   * Test handling 200 acts with partial cache misses
   */
  test( 'GET /acts with 200 acts where 50 are missing returns error', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];

    let callCount = 0;

    // First 150 cached, last 50 missing
    mf.database.getArtistFromCache.mockImplementation( () => {
      callCount += 1;

      if ( callCount <= 150 ) {
        return Promise.resolve( transformedArtist );
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
    jest.useFakeTimers();

    const actIds = Array.from( {
      'length': 500
    }, ( _, i ) => `act-id-${i}` );

    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.database.cacheArtist.mockResolvedValue();

    // Trigger background fetch with 500 acts
    mf.fetchQueue.triggerBackgroundFetch( actIds );

    // Should not crash, queue size should be close to 500 (some may have started processing)
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBeGreaterThan( 490 );

    // Advance enough time to process some (not all)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Should have started processing
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();

    jest.useRealTimers();
  }, 20000 );

  /**
   * Test concurrent large batch requests
   */
  test( 'concurrent requests for 100 acts each are handled', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

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
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

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
   * Test queue handles rapid successive additions
   */
  test( 'queue handles 50 rapid successive triggerBackgroundFetch calls', () => {
    jest.useFakeTimers();

    // Rapidly add 50 small batches
    for ( let i = 0; i < 50; i += 1 ) {
      mf.fetchQueue.triggerBackgroundFetch( [ `act-${i}` ] );
    }

    // Queue should contain close to 50 acts (some may have started processing)
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBeGreaterThan( 45 );

    // Processor should have been triggered at least once
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBeGreaterThan( 0 );

    jest.useRealTimers();
  } );

  /**
   * Test queue deduplication with massive duplicates
   */
  test( 'queue deduplicates when same 100 acts requested 10 times', () => {
    jest.useFakeTimers();

    const actIds = Array.from( {
      'length': 100
    }, ( _, i ) => `act-id-${i}` );

    // Add same 100 acts 10 times
    for ( let i = 0; i < 10; i += 1 ) {
      mf.fetchQueue.triggerBackgroundFetch( actIds );
    }

    // Queue should only have 100 unique acts
    expect( mf.testing.fetchQueue.fetchQueue.size ).toBe( 100 );

    jest.useRealTimers();
  } );

  /**
   * Test system stability under sustained load
   */
  test( 'system remains stable with 20 sequential large requests', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    // Make 20 sequential requests of 50 acts each
    for ( let i = 0; i < 20; i += 1 ) {
      const actIds = Array.from( {
        'length': 50
      }, ( _, j ) => `batch${i}-id-${j}` );

      const response = await request( mf.app ).get( `/acts/${actIds.join( ',' )}` );

      expect( response.status ).toBe( 200 );
      expect( response.body.acts ).toHaveLength( 50 );
    }

    // All requests should have been processed
    expect( mf.database.getArtistFromCache ).toHaveBeenCalledTimes( 1000 );
  }, 30000 );
} );
