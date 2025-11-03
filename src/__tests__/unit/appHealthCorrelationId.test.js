/**
 * Unit tests for /admin/health correlation ID in response bodies
 * @module __tests__/unit/appHealthCorrelationId
 */

const request = require( 'supertest' );
const speakeasy = require( 'speakeasy' );
require( '../../app' );
require( '../../services/actService' );

describe( 'Express App - /admin/health Correlation ID in Response Body', () => {
  const validTotpConfig = {
    'secret': 'TESTSECRET',
    'encoding': 'base32',
    'algorithm': 'sha1'
  };
  const validPassword = 'testpass';
  let originalEnv;

  beforeEach( () => {
    jest.clearAllMocks();

    originalEnv = {
      'ADMIN_TOTP_CONFIG': process.env.ADMIN_TOTP_CONFIG,
      'ADMIN_PASS': process.env.ADMIN_PASS
    };

    process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );
    process.env.ADMIN_PASS = validPassword;

    // Mock database functions
    mf.database = mf.database || {};
    mf.database.getAllActIds = jest.fn();
    mf.database.getAllActsWithMetadata = jest.fn();
    mf.database.getActsWithoutBandsintown = jest.fn();
    mf.databaseAdmin.getRecentUpdateErrors = jest.fn();
    mf.databaseAdmin.clearCache = jest.fn();

    // Reset usage stats
    mf.usageStats.requests = 0;
    mf.usageStats.actsQueried = 0;
  } );

  afterEach( () => {
    process.env.ADMIN_TOTP_CONFIG = originalEnv.ADMIN_TOTP_CONFIG;
    process.env.ADMIN_PASS = originalEnv.ADMIN_PASS;
  } );

  /**
   * Helper to create authenticated request
   * @returns {object} Supertest request with valid auth
   */
  const getAuthenticatedRequest = () => {
    const token = speakeasy.totp( {
      ...validTotpConfig,
      'time': Date.now() / 1000
    } );

    return request( mf.app ).get( '/admin/health' ).set( 'Authorization', `pass ${validPassword}, bearer ${token}` );
  };

  /**
   * Helper to create authenticated DELETE request
   * @returns {object} Supertest request with valid auth
   */
  const getAuthenticatedDeleteRequest = () => {
    const token = speakeasy.totp( {
      ...validTotpConfig,
      'time': Date.now() / 1000
    } );

    return request( mf.app ).delete( '/admin/health/cache' ).set( 'Authorization', `pass ${validPassword}, bearer ${token}` );
  };

  /**
   * Test that correlation ID appears in meta for GET /admin/health auth error
   */
  test( 'includes correlation ID in response.meta for GET /admin/health auth error', async () => {
    const response = await request( mf.app ).
      get( '/admin/health' ).
      expect( 401 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID appears in meta for GET /admin/health success
   */
  test( 'includes correlation ID in response.meta for GET /admin/health success', async () => {
    mf.database.getAllActIds.mockResolvedValue( [ 'act1', 'act2' ] );
    mf.database.getAllActsWithMetadata.mockResolvedValue( [
      {
        '_id': 'act1',
        'updatedAt': '2024-01-01 12:00:00'
      },
      {
        '_id': 'act2',
        'updatedAt': '2024-01-02 12:00:00'
      }
    ] );
    mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );
    mf.databaseAdmin.getRecentUpdateErrors.mockResolvedValue( [] );

    const response = await getAuthenticatedRequest().expect( 200 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID appears in meta for GET /admin/health error
   */
  test( 'includes correlation ID in response.meta for GET /admin/health error', async () => {
    mf.database.getAllActIds.mockRejectedValue( new Error( 'Database error' ) );

    const response = await getAuthenticatedRequest().expect( 500 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID appears in meta for DELETE /admin/health/cache auth error
   */
  test( 'includes correlation ID in response.meta for DELETE /admin/health/cache auth error', async () => {
    const response = await request( mf.app ).
      delete( '/admin/health/cache' ).
      expect( 401 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID appears in meta for DELETE /admin/health/cache success
   */
  test( 'includes correlation ID in response.meta for DELETE /admin/health/cache success', async () => {
    mf.databaseAdmin.clearCache.mockResolvedValue();

    const response = await getAuthenticatedDeleteRequest().expect( 200 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );

  /**
   * Test that correlation ID appears in meta for DELETE /admin/health/cache error
   */
  test( 'includes correlation ID in response.meta for DELETE /admin/health/cache error', async () => {
    mf.databaseAdmin.clearCache.mockRejectedValue( new Error( 'Clear cache failed' ) );

    const response = await getAuthenticatedDeleteRequest().expect( 500 );

    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.correlationId ).toBeDefined();
    expect( response.body.meta.correlationId ).toBe( response.headers[ 'x-correlation-id' ] );
  } );
} );
