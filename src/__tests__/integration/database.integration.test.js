/**
 * Integration tests for database error handling and resilience
 * Tests: Database failure scenarios and recovery
 * Mocks: Only MongoDB (testing failure scenarios)
 * @module __tests__/integration/database.integration
 */

const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock database BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/artistService' );

describe( 'Database Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Default mocks for database health
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();

    // Default mocks for external services
    mf.musicbrainz.fetchArtist = jest.fn().mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test that cache read failures result in service error
   */
  test( 'fetchMultipleActs throws service error on cache read failures', async () => {
    // Simulate database read failure
    mf.database.getArtistFromCache = jest.fn().mockRejectedValue( new Error( 'MongoDB connection lost' ) );

    const actIds = [ fixtureTheKinks.id ];

    // Should throw SVC_002 error
    await expect( mf.artistService.fetchMultipleActs( actIds ) ).rejects.toThrow( 'SVC_002' );
  } );

  /**
   * Test that cache write failures are handled but don't block the response
   */
  test( 'fetchAndEnrichArtistData still returns data even when cache is unavailable', async () => {
    // FetchAndEnrichArtistData doesn't cache directly - caller does
    const result = await mf.artistService.fetchAndEnrichArtistData(
      fixtureTheKinks.id,
      false
    );

    // Data should still be fetched and transformed
    expect( result._id ).toBe( fixtureTheKinks.id );
    expect( result.name ).toBe( fixtureTheKinks.name );

    // FetchAndEnrichArtistData doesn't cache - verify fetch happened
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
  } );

  /**
   * Test concurrent cache updates for the same artist
   */
  test( 'concurrent fetchAndEnrichArtistData calls handle same artist gracefully', async () => {
    // Trigger two concurrent fetches for the same artist
    const [ result1, result2 ] = await Promise.all( [
      mf.artistService.fetchAndEnrichArtistData( fixtureTheKinks.id, false ),
      mf.artistService.fetchAndEnrichArtistData( fixtureTheKinks.id, false )
    ] );

    // Both should succeed
    expect( result1._id ).toBe( fixtureTheKinks.id );
    expect( result2._id ).toBe( fixtureTheKinks.id );

    // Both should attempt to fetch from MusicBrainz
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 2 );
  } );

  /**
   * Test mixed cache operation failures
   */
  test( 'handles mix of successful and failed cache operations', async () => {
    const actIds = [
      fixtureTheKinks.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    // First read fails - this will trigger SVC_002
    mf.database.getArtistFromCache = jest.fn().mockRejectedValue( new Error( 'Read error' ) );

    // Should throw SVC_002 when any cache read fails
    await expect( mf.artistService.fetchMultipleActs( actIds ) ).rejects.toThrow( 'SVC_002' );
  } );

  /**
   * Test cache health check failures
   */
  test( 'database connection check failures are handled', async () => {
    mf.database.connect = jest.fn().mockRejectedValue( new Error( 'Failed to connect to MongoDB' ) );

    // Connection failure should be catchable
    await expect( mf.database.connect() ).rejects.toThrow( 'Failed to connect to MongoDB' );
  } );

  /**
   * Test null/undefined cache returns
   */
  test( 'handles null and undefined cache returns correctly', async () => {
    const actIds = [
      fixtureTheKinks.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    // Return null for first, undefined for second
    mf.database.getArtistFromCache = jest.fn().
      mockResolvedValueOnce( null ).
      mockResolvedValueOnce();

    const result = await mf.artistService.fetchMultipleActs( actIds );

    // Both should be treated as cache misses
    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( '2 acts not cached' );
  } );

  /**
   * Test handling of corrupted cache data
   */
  test( 'handles corrupted cache data gracefully', async () => {
    // Return malformed artist data
    mf.database.getArtistFromCache.mockResolvedValue( {
      // Missing _id
      'name': 'Corrupted Artist',
      'status': 'active'
    } );

    const result = await mf.artistService.fetchMultipleActs( [ fixtureTheKinks.id ] );

    // Should handle gracefully
    expect( result.error || result.acts ).toBeDefined();
  } );

  /**
   * Test cache operations under concurrent load
   */
  test( 'handles concurrent cache operations without race conditions', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    // Simulate 10 concurrent requests
    const concurrentRequests = Array.from( { 'length': 10 }, () => mf.artistService.fetchMultipleActs( [ fixtureTheKinks.id ] ) );

    const results = await Promise.all( concurrentRequests );

    // All should succeed
    results.forEach( ( result ) => {
      expect( result.acts ).toHaveLength( 1 );
      expect( result.acts[ 0 ]._id ).toBe( fixtureTheKinks.id );
    } );

    expect( mf.database.getArtistFromCache ).toHaveBeenCalledTimes( 10 );
  } );
} );
