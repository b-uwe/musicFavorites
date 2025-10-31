/**
 * Unit tests for GET /health route
 */

const request = require( 'supertest' );
require( '../../app' );
require( '../../services/database' );

describe( 'Express App - /health Route Tests', () => {
  let app;

  beforeEach( () => {
    jest.clearAllMocks();

    // Mock database functions
    mf.database = mf.database || {};
    mf.database.testCacheHealth = jest.fn();

    ( { app } = globalThis.mf );
  } );

  describe( 'GET /health - Database connectivity', () => {
    /**
     * Test that /health returns 200 when database is healthy
     */
    test( 'returns 200 with healthy status when database is connected', async () => {
      // Mock successful database health check
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      expect( response.status ).toBe( 200 );
      expect( response.body.status ).toBe( 'healthy' );
      expect( response.body.timestamp ).toBeDefined();
      expect( response.body.uptime ).toBeGreaterThan( 0 );
    } );

    /**
     * Test that /health returns 503 when database is unavailable
     */
    test( 'returns 503 with unhealthy status when database is unavailable', async () => {
      // Mock database health check failure
      mf.database.testCacheHealth.mockRejectedValue( new Error( 'Connection failed' ) );

      const response = await request( app ).get( '/health' );

      expect( response.status ).toBe( 503 );
      expect( response.body.status ).toBe( 'unhealthy' );
      expect( response.body.reason ).toBe( 'database_unavailable' );
      expect( response.body.timestamp ).toBeDefined();
    } );

    /**
     * Test that /health calls testCacheHealth
     */
    test( 'calls database testCacheHealth method', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      await request( app ).get( '/health' );

      expect( mf.database.testCacheHealth ).toHaveBeenCalledTimes( 1 );
    } );
  } );

  describe( 'GET /health - Response format', () => {
    /**
     * Test that /health response includes required fields
     */
    test( 'includes status, timestamp, and uptime in response', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      expect( response.body ).toHaveProperty( 'status' );
      expect( response.body ).toHaveProperty( 'timestamp' );
      expect( response.body ).toHaveProperty( 'uptime' );
    } );

    /**
     * Test that /health timestamp is valid ISO 8601 format
     */
    test( 'returns timestamp in ISO 8601 format', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      const { timestamp } = response.body;
      expect( timestamp ).toMatch( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u );
      expect( () => new Date( timestamp ) ).not.toThrow();
    } );

    /**
     * Test that uptime is a positive number
     */
    test( 'returns positive uptime value', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      expect( typeof response.body.uptime ).toBe( 'number' );
      expect( response.body.uptime ).toBeGreaterThan( 0 );
    } );

    /**
     * Test that unhealthy response does not include uptime
     */
    test( 'does not include uptime when unhealthy', async () => {
      mf.database.testCacheHealth.mockRejectedValue( new Error( 'Connection failed' ) );

      const response = await request( app ).get( '/health' );

      expect( response.body ).not.toHaveProperty( 'uptime' );
      expect( response.body ).toHaveProperty( 'status' );
      expect( response.body ).toHaveProperty( 'reason' );
      expect( response.body ).toHaveProperty( 'timestamp' );
    } );
  } );

  describe( 'GET /health - Headers', () => {
    /**
     * Test that /health includes no-cache headers
     */
    test( 'includes Cache-Control no-cache headers', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      expect( response.headers[ 'cache-control' ] ).toBe( 'no-cache, no-store, must-revalidate' );
    } );

    /**
     * Test that /health includes no-cache headers even on failure
     */
    test( 'includes Cache-Control headers even when unhealthy', async () => {
      mf.database.testCacheHealth.mockRejectedValue( new Error( 'Connection failed' ) );

      const response = await request( app ).get( '/health' );

      expect( response.headers[ 'cache-control' ] ).toBe( 'no-cache, no-store, must-revalidate' );
    } );
  } );

  describe( 'GET /health - No authentication required', () => {
    /**
     * Test that /health does not require authentication
     */
    test( 'returns 200 without authentication headers', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).get( '/health' );

      expect( response.status ).toBe( 200 );
    } );

    /**
     * Test that /health ignores Authorization header
     */
    test( 'works with arbitrary Authorization header', async () => {
      mf.database.testCacheHealth.mockResolvedValue( true );

      const response = await request( app ).
        get( '/health' ).
        set( 'Authorization', 'Bearer invalid-token' );

      expect( response.status ).toBe( 200 );
      expect( response.body.status ).toBe( 'healthy' );
    } );
  } );
} );
