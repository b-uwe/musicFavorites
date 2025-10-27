/**
 * Integration tests for error propagation across modules
 * Tests: Errors flow correctly from database → service → app → HTTP response
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/errorPropagation.integration
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
require( '../../services/actService' );
require( '../../app' );

describe( 'Error Propagation Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    jest.clearAllMocks();

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

  /**
   * Test database error propagates to HTTP 500
   */
  test( 'database error propagates to HTTP 500 with proper error structure', async () => {
    // Mock MongoDB driver to reject at database read level
    mockCollection.findOne.mockRejectedValue( new Error( 'Database connection lost' ) );

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
    // Mock MongoDB driver to reject asynchronously
    mockCollection.findOne.mockRejectedValue( new Error( 'Async database error' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test service layer error propagates to HTTP 503
   */
  test( 'service error for missing acts propagates to HTTP 503', async () => {
    // Multiple acts missing triggers 503 - MongoDB returns null
    mockCollection.findOne.mockResolvedValue( null );

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
    // Mock MongoDB driver timeout
    mockCollection.findOne.mockRejectedValue( timeoutError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test null/undefined error handling through layers
   */
  test( 'null errors are handled gracefully across layers', async () => {
    // Mock MongoDB driver to throw null
    mockCollection.findOne.mockImplementation( () => {
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

    // Mock MongoDB driver to reject with weird error
    mockCollection.findOne.mockRejectedValue( weirdError );

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

    // Mock MongoDB driver to throw different errors on each call
    mockCollection.findOne.mockImplementation( () => {
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
    // Mock MongoDB driver to throw error with stack trace
    mockCollection.findOne.mockImplementation( () => {
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
