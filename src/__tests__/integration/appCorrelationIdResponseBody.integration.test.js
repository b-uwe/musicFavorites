/**
 * Integration tests for correlation ID in response bodies
 * Tests: Express /acts, /health → correlation ID in JSON responses
 * Mocks: Only external I/O (mongodb, axios)
 */

const request = require( 'supertest' );
const { MongoClient } = require( 'mongodb' );
const axios = require( 'axios' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../app' );

describe( 'Express App - Correlation ID in Response Bodies Integration', () => {
  let mockCollection;
  let app;

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
      'deleteOne': jest.fn(),
      'findOne': jest.fn(),
      'updateOne': jest.fn(),
      'find': jest.fn()
    };

    // Set default successful responses
    mockCollection.insertOne.mockResolvedValue( { 'acknowledged': true } );
    mockCollection.deleteOne.mockResolvedValue( { 'acknowledged': true } );
    mockCollection.findOne.mockResolvedValue( null );
    mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );
    mockCollection.find.mockReturnValue( {
      'toArray': jest.fn().mockResolvedValue( [] )
    } );

    MongoClient.mockImplementation( () => ( {
      'connect': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( {
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } ),
        'collection': jest.fn().mockReturnValue( mockCollection )
      } ),
      'close': jest.fn().mockResolvedValue()
    } ) );

    // Mock axios for external API calls
    axios.get.mockResolvedValue( {
      'data': {},
      'status': 200
    } );

    // Connect database before each test
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await mf.database.connect();

    ( { app } = globalThis.mf );
  } );

  /**
   * Test /health endpoint includes correlationId in response body
   */
  test( 'GET /health includes correlationId in response body meta', async () => {
    const response = await request( app ).get( '/health' );

    expect( response.status ).toBe( 200 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toMatch( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u );
  } );

  /**
   * Test correlationId in response body matches X-Correlation-ID header
   */
  test( 'correlationId in response body matches X-Correlation-ID header', async () => {
    const response = await request( app ).get( '/health' );

    expect( response.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test /acts GET endpoint includes correlationId in response body
   */
  test( 'GET /acts/:id includes correlationId in response body meta', async () => {
    // Mock database to return cached act
    mockCollection.findOne.mockResolvedValue( {
      '_id': 'test-artist',
      'name': 'Test Artist',
      'updatedAt': new Date().toISOString()
    } );

    const response = await request( app ).get( '/acts/test-artist' );

    expect( response.status ).toBe( 200 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test /acts POST endpoint includes correlationId in response body
   */
  test( 'POST /acts includes correlationId in response body meta', async () => {
    // Mock database to return cached act
    mockCollection.findOne.mockResolvedValue( {
      '_id': 'test-artist',
      'name': 'Test Artist',
      'updatedAt': new Date().toISOString()
    } );

    const response = await request( app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( 'test-artist' );

    expect( response.status ).toBe( 200 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test 404 responses include correlationId in response body
   */
  test( '404 responses include correlationId in response body meta', async () => {
    const response = await request( app ).get( '/nonexistent' );

    expect( response.status ).toBe( 404 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test error responses include correlationId in response body
   */
  test( 'error responses include correlationId in response body meta', async () => {
    // Make database health check fail - both operations need to fail
    mockCollection.insertOne.mockRejectedValueOnce( new Error( 'Database error' ) );
    mockCollection.deleteOne.mockRejectedValueOnce( new Error( 'Database error' ) );

    const response = await request( app ).get( '/health' );

    expect( response.status ).toBe( 503 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test validation error responses include correlationId in response body
   */
  test( 'POST /acts validation errors include correlationId in response body meta', async () => {
    // Empty body triggers validation error
    const response = await request( app ).
      post( '/acts' ).
      set( 'Content-Type', 'text/plain' ).
      send( '' );

    expect( response.status ).toBe( 400 );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test each request gets unique correlationId
   */
  test( 'each request gets unique correlationId', async () => {
    const response1 = await request( app ).get( '/health' );
    const response2 = await request( app ).get( '/health' );

    expect( response1.body.meta.correlationId ).toBeDefined();
    expect( response2.body.meta.correlationId ).toBeDefined();
    expect( response1.body.meta.correlationId ).not.toBe( response2.body.meta.correlationId );
  } );
} );
