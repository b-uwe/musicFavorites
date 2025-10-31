/**
 * Integration tests for GET /health route
 * Tests: Express /health → database.testCacheHealth workflow
 * Mocks: Only external I/O (mongodb)
 */

const request = require( 'supertest' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'mongodb' );

const { MongoClient } = require( 'mongodb' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../app' );

describe( 'Express App - /health Integration Tests', () => {
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

    // Mock MongoDB driver with health check support
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
  } );

  /**
   * Test /health endpoint returns unhealthy when database fails
   */
  test( 'GET /health returns unhealthy status when database fails', async () => {
    mockCollection.insertOne.mockRejectedValue( new Error( 'Database connection lost' ) );

    const response = await request( app ).get( '/health' );

    expect( response.status ).toBe( 503 );
    expect( response.body ).toEqual( {
      'status': 'unhealthy',
      'reason': 'database_unavailable',
      'timestamp': expect.stringMatching( /^\d{4}-\d{2}-\d{2}T/u )
    } );
  } );

  /**
   * Test /health sets correct HTTP headers
   */
  test( 'GET /health sets appropriate caching headers', async () => {
    const response = await request( app ).get( '/health' );

    expect( response.headers[ 'cache-control' ] ).toBe( 'no-cache, no-store, must-revalidate' );
    expect( response.headers[ 'content-type' ] ).toContain( 'application/json' );
  } );

  /**
   * Test /health does not affect other routes
   */
  test( 'GET /health does not interfere with other routes', async () => {
    // Call /health
    await request( app ).get( '/health' );

    // Call non-existent route
    const response = await request( app ).get( '/non-existent-route' );

    expect( response.status ).toBe( 404 );
    expect( response.body.error ).toBe( 'Not found' );
  } );
} );
