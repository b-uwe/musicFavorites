/**
 * Integration tests for HTTP logging middleware
 * Tests: Express middleware → logger integration
 * Mocks: Only external I/O (mongodb)
 */

const request = require( 'supertest' );
const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../app' );

describe( 'Express App - HTTP Logging Middleware Integration', () => {
  let mockCollection;
  let app;
  let infoSpy;

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
      'insertOne': jest.fn(),
      'deleteOne': jest.fn()
    };

    // Set default successful health check responses
    mockCollection.insertOne.mockResolvedValue( { 'acknowledged': true } );
    mockCollection.deleteOne.mockResolvedValue( { 'acknowledged': true } );

    MongoClient.mockImplementation( () => ( {
      'connect': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( {
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } ),
        'collection': jest.fn().mockReturnValue( mockCollection )
      } ),
      'close': jest.fn().mockResolvedValue()
    } ) );

    // Connect database before each test
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await mf.database.connect();

    ( { app } = globalThis.mf );

    // Spy on logger.info to verify HTTP logging
    infoSpy = jest.spyOn( mf.logger, 'info' );
  } );

  afterEach( () => {
    if ( infoSpy ) {
      infoSpy.mockRestore();
    }
  } );

  /**
   * Test that HTTP middleware logs requests with proper structure
   */
  test( 'HTTP logging middleware logs requests with method, path, status, and duration', async () => {
    await request( app ).get( '/health' );

    // Find the HTTP request log
    const logCalls = infoSpy.mock.calls.filter( ( call ) => call[ 1 ] === 'HTTP request' );

    expect( logCalls.length ).toBeGreaterThan( 0 );
    expect( logCalls[ 0 ][ 0 ] ).toMatchObject( {
      'method': 'GET',
      'path': '/health',
      'statusCode': expect.any( Number ),
      'duration': expect.any( Number ),
      'correlationId': expect.stringMatching( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u )
    } );
  } );

  /**
   * Test that middleware logs different HTTP methods correctly
   */
  test( 'HTTP logging middleware logs POST requests', async () => {
    // Mock actService for POST /acts
    mf.actService.fetchMultipleActs = jest.fn().mockResolvedValue( { 'acts': [] } );

    await request( app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( 'test-id' );

    const logCalls = infoSpy.mock.calls.filter( ( call ) => call[ 1 ] === 'HTTP request' );

    expect( logCalls.length ).toBeGreaterThan( 0 );
    expect( logCalls[ 0 ][ 0 ] ).toMatchObject( {
      'method': 'POST',
      'path': '/acts'
    } );
  } );

  /**
   * Test that middleware logs 404 responses
   */
  test( 'HTTP logging middleware logs 404 responses', async () => {
    await request( app ).get( '/nonexistent' );

    const logCalls = infoSpy.mock.calls.filter( ( call ) => call[ 1 ] === 'HTTP request' );

    expect( logCalls.length ).toBeGreaterThan( 0 );
    expect( logCalls[ 0 ][ 0 ] ).toMatchObject( {
      'method': 'GET',
      'path': '/nonexistent',
      'statusCode': 404
    } );
  } );
} );
