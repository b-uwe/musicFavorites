/**
 * Integration tests for error propagation across modules
 * Tests: Errors flow correctly from database → service → app → HTTP response
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/errorPropagation.integration
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
require( '../../services/actService' );
require( '../../app' );

describe( 'Error Propagation Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Default mocks
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getActFromCache = jest.fn();
    mf.database.cacheAct = jest.fn().mockResolvedValue();
    mf.musicbrainz.fetchAct = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
  } );

  /**
   * Test database error propagates to HTTP 500
   */
  test( 'database error propagates to HTTP 500 with proper error structure', async () => {
    mf.database.getActFromCache.mockRejectedValue( new Error( 'Database connection lost' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    // Verify error structure
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();

    // Verify meta is included
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );

  /**
   * Test async rejection propagates correctly
   */
  test( 'async database rejection propagates to HTTP 500', async () => {
    mf.database.getActFromCache.mockRejectedValue( new Error( 'Async database error' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test service layer error propagates to HTTP 503
   */
  test( 'service error for missing acts propagates to HTTP 503', async () => {
    // Multiple acts missing triggers 503
    mf.database.getActFromCache.mockResolvedValue( null );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id},other-id` ).
      expect( 503 );

    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toContain( '2 acts not cached' );
  } );

  /**
   * Test timeout error propagation
   */
  test( 'timeout errors propagate with appropriate status code', async () => {
    const timeoutError = new Error( 'Operation timed out after 30s' );

    timeoutError.code = 'ETIMEDOUT';
    mf.database.getActFromCache.mockRejectedValue( timeoutError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test null/undefined error handling through layers
   */
  test( 'null errors are handled gracefully across layers', async () => {
    mf.database.getActFromCache.mockImplementation( () => {
      throw null;
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` );

    // Should still return error response
    expect( response.status ).toBeGreaterThanOrEqual( 500 );
  } );

  /**
   * Test error with missing message property
   */
  test( 'errors without message property are handled', async () => {
    const weirdError = {
      'code': 'UNKNOWN',
      'stack': 'Some stack trace'
    };

    mf.database.getActFromCache.mockRejectedValue( weirdError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` );

    expect( response.status ).toBeGreaterThanOrEqual( 500 );
    expect( response.body.error ).toBeDefined();
  } );

  /**
   * Test multiple concurrent errors
   */
  test( 'concurrent requests with errors are handled independently', async () => {
    let callCount = 0;

    mf.database.getActFromCache.mockImplementation( () => {
      callCount += 1;

      if ( callCount === 1 ) {
        throw new Error( 'First error' );
      }

      throw new Error( 'Second error' );
    } );

    const [ response1, response2 ] = await Promise.all( [
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` ),
      request( mf.app ).get( `/acts/${fixtureTheKinks.id}` )
    ] );

    // Both should error independently
    expect( response1.status ).toBe( 500 );
    expect( response2.status ).toBe( 500 );
  } );

  /**
   * Test stack trace not leaked in production errors
   */
  test( 'error responses do not leak stack traces', async () => {
    mf.database.getActFromCache.mockImplementation( () => {
      const error = new Error( 'Internal error' );

      error.stack = 'SENSITIVE STACK TRACE DATA';

      throw error;
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    // Stack should not be in response
    const responseString = JSON.stringify( response.body );

    expect( responseString ).not.toContain( 'SENSITIVE STACK TRACE' );
  } );
} );
