/**
 * Unit tests for app.js correlation ID middleware
 * @module __tests__/unit/appCorrelationId
 */

const request = require( 'supertest' );
require( '../../app' );
require( '../../services/actService' );

describe( 'Express App - Correlation ID Middleware', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock actService functions
    mf.actService.fetchMultipleActs = jest.fn();

    // Mock database functions
    mf.database = mf.database || {};
    mf.database.testCacheHealth = jest.fn();
  } );

  /**
   * Test that correlation ID is generated for each request
   */
  test( 'generates unique correlation ID for each request', async () => {
    mf.actService.fetchMultipleActs.mockResolvedValue( {
      'acts': []
    } );

    const response1 = await request( mf.app ).get( '/acts/test-id-1' ).expect( 200 );
    const response2 = await request( mf.app ).get( '/acts/test-id-2' ).expect( 200 );

    expect( response1.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response2.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response1.headers[ 'x-correlation-id' ] ).not.toBe( response2.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID has correct format
   */
  test( 'correlation ID has correct format (req-timestamp-random)', async () => {
    mf.actService.fetchMultipleActs.mockResolvedValue( {
      'acts': []
    } );

    const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );
    const correlationId = response.headers[ 'x-correlation-id' ];

    expect( correlationId ).toMatch( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u );
  } );

  /**
   * Test that correlation ID is included in HTTP request logs
   */
  test( 'includes correlation ID in HTTP request logs', async () => {
    const infoSpy = jest.spyOn( mf.logger, 'info' ).mockImplementation( () => {
      // Mock implementation to prevent actual logging
    } );

    mf.actService.fetchMultipleActs.mockResolvedValue( {
      'acts': []
    } );

    const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );
    const correlationId = response.headers[ 'x-correlation-id' ];

    expect( infoSpy ).toHaveBeenCalledWith(
      expect.objectContaining( {
        correlationId,
        'method': 'GET',
        'path': '/acts/test-id',
        'statusCode': 200
      } ),
      'HTTP request'
    );

    infoSpy.mockRestore();
  } );

  /**
   * Test that correlation ID is set for health endpoint
   */
  test( 'sets correlation ID header for /health endpoint', async () => {
    mf.database.testCacheHealth.mockResolvedValue();

    const response = await request( mf.app ).get( '/health' ).expect( 200 );

    expect( response.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response.headers[ 'x-correlation-id' ] ).toMatch( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u );
  } );

  /**
   * Test that correlation ID is set for robots.txt
   */
  test( 'sets correlation ID header for /robots.txt endpoint', async () => {
    const response = await request( mf.app ).get( '/robots.txt' ).expect( 200 );

    expect( response.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response.headers[ 'x-correlation-id' ] ).toMatch( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u );
  } );

  /**
   * Test that correlation ID is set even for 404 responses
   */
  test( 'sets correlation ID header for 404 responses', async () => {
    const response = await request( mf.app ).get( '/nonexistent' ).expect( 404 );

    expect( response.headers[ 'x-correlation-id' ] ).toBeDefined();
    expect( response.headers[ 'x-correlation-id' ] ).toMatch( /^req-[a-z0-9]+-[A-Za-z0-9_-]+$/u );
  } );
} );
