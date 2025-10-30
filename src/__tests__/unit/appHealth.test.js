/**
 * Unit tests for app.js /admin/health endpoint
 * Tests health endpoint behavior with mocked database
 * @module __tests__/unit/appHealth
 */

const request = require( 'supertest' );
const speakeasy = require( 'speakeasy' );
require( '../../app' );
require( '../../services/actService' );
require( '../../testHelpers/integrationTestSetup' );

describe( 'Express App - /admin/health Route Tests', () => {
  const { getRecentBerlinTimestamp } = mf.testing.integrationTestSetup;

  beforeEach( () => {
    jest.clearAllMocks();

    // Mock actService functions
    mf.actService.fetchMultipleActs = jest.fn();

    // Mock database functions
    mf.database = mf.database || {};
    mf.database.getAllActIds = jest.fn();
    mf.database.getAllActsWithMetadata = jest.fn();
    mf.database.getActsWithoutBandsintown = jest.fn();
    mf.database.getRecentUpdateErrors = jest.fn();

    // Reset usage stats
    mf.usageStats.requests = 0;
    mf.usageStats.actsQueried = 0;
  } );

  describe( 'GET /admin/health - Authentication', () => {
    const validTotpConfig = {
      'secret': 'TESTSECRET',
      'encoding': 'base32',
      'algorithm': 'sha1'
    };
    const validPassword = 'testpass';
    let originalEnv;

    beforeEach( () => {
      originalEnv = {
        'ADMIN_TOTP_CONFIG': process.env.ADMIN_TOTP_CONFIG,
        'ADMIN_PASS': process.env.ADMIN_PASS
      };

      process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );
      process.env.ADMIN_PASS = validPassword;

      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );
      mf.database.getRecentUpdateErrors.mockResolvedValue( [] );
    } );

    afterEach( () => {
      process.env.ADMIN_TOTP_CONFIG = originalEnv.ADMIN_TOTP_CONFIG;
      process.env.ADMIN_PASS = originalEnv.ADMIN_PASS;
    } );

    /**
     * Test that missing ADMIN_TOTP_CONFIG returns 500
     */
    test( 'returns 500 when ADMIN_TOTP_CONFIG not set', async () => {
      delete process.env.ADMIN_TOTP_CONFIG;

      const response = await request( mf.app ).get( '/admin/health' ).expect( 500 );

      expect( response.body.error ).toBe( 'Admin authentication not configured' );
    } );

    /**
     * Test that invalid JSON in ADMIN_TOTP_CONFIG returns 500
     */
    test( 'returns 500 when ADMIN_TOTP_CONFIG has invalid JSON', async () => {
      process.env.ADMIN_TOTP_CONFIG = 'not-valid-json';

      const response = await request( mf.app ).get( '/admin/health' ).expect( 500 );

      expect( response.body.error ).toBe( 'Admin authentication misconfigured' );
    } );

    /**
     * Test that missing Authorization header returns 401
     */
    test( 'returns 401 when Authorization header missing', async () => {
      const response = await request( mf.app ).get( '/admin/health' ).expect( 401 );

      expect( response.body.error ).toBe( 'Unauthorized' );
    } );

    /**
     * Test that invalid Authorization header format returns 401
     */
    test( 'returns 401 when Authorization header has invalid format', async () => {
      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', 'Bearer token' ).
        expect( 401 );

      expect( response.body.error ).toBe( 'Unauthorized' );
    } );

    /**
     * Test that wrong password returns 401
     */
    test( 'returns 401 when password is incorrect', async () => {
      const token = speakeasy.totp( validTotpConfig );

      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass wrongpass, bearer ${token}` ).
        expect( 401 );

      expect( response.body.error ).toBe( 'Unauthorized' );
    } );

    /**
     * Test that invalid TOTP token returns 401
     */
    test( 'returns 401 when TOTP token is invalid', async () => {
      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer 000000` ).
        expect( 401 );

      expect( response.body.error ).toBe( 'Unauthorized' );
    } );

    /**
     * Test that valid credentials return 200
     */
    test( 'returns 200 with valid credentials', async () => {
      const token = speakeasy.totp( validTotpConfig );

      await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` ).
        expect( 200 );
    } );

    /**
     * Test that Authorization header is case-insensitive for 'pass' and 'bearer'
     */
    test( 'accepts case-insensitive pass and bearer keywords', async () => {
      const token = speakeasy.totp( validTotpConfig );

      await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `PASS ${validPassword}, BEARER ${token}` ).
        expect( 200 );
    } );

    /**
     * Test that extra whitespace in token is handled
     */
    test( 'trims whitespace from TOTP token', async () => {
      const token = speakeasy.totp( validTotpConfig );

      await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer  ${token}  ` ).
        expect( 200 );
    } );
  } );

  describe( 'GET /admin/health - Response data', () => {
    const validTotpConfig = {
      'secret': 'TESTSECRET',
      'encoding': 'base32',
      'algorithm': 'sha1'
    };
    const validPassword = 'testpass';
    let originalEnv;

    /**
     * Helper to make authenticated request
     * @returns {object} Supertest request with auth header
     */
    const authenticatedRequest = () => {
      const token = speakeasy.totp( validTotpConfig );
      return request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` );
    };

    beforeEach( () => {
      originalEnv = {
        'ADMIN_TOTP_CONFIG': process.env.ADMIN_TOTP_CONFIG,
        'ADMIN_PASS': process.env.ADMIN_PASS
      };

      process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );
      process.env.ADMIN_PASS = validPassword;
    } );

    afterEach( () => {
      process.env.ADMIN_TOTP_CONFIG = originalEnv.ADMIN_TOTP_CONFIG;
      process.env.ADMIN_PASS = originalEnv.ADMIN_PASS;
    } );

    /**
     * Test empty cache returns null for lastCacheUpdate
     */
    test( 'returns null lastCacheUpdate when cache is empty', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.status ).toBe( 'ok' );
      expect( response.body.cacheSize ).toBe( 0 );
      expect( response.body.lastCacheUpdate ).toBeNull();
      expect( response.body ).toHaveProperty( 'uptime' );
      expect( response.body ).toHaveProperty( 'usageStats' );
    } );

    /**
     * Test cache with one act
     */
    test( 'returns correct data with one cached act', async () => {
      const mockAct = {
        '_id': 'act-123',
        'updatedAt': new Date( '2025-10-28T12:00:00Z' )
      };

      mf.database.getAllActIds.mockResolvedValue( [ 'act-123' ] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [ mockAct ] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.status ).toBe( 'ok' );
      expect( response.body.cacheSize ).toBe( 1 );
      expect( response.body.lastCacheUpdate.newest._id ).toBe( 'act-123' );
      expect( response.body.lastCacheUpdate.oldest._id ).toBe( 'act-123' );
    } );

    /**
     * Test cache with multiple acts
     */
    test( 'returns correct newest and oldest with multiple acts', async () => {
      const mockActs = [
        {
          '_id': 'act-old',
          'updatedAt': new Date( '2025-10-25T12:00:00Z' )
        },
        {
          '_id': 'act-new',
          'updatedAt': new Date( '2025-10-28T12:00:00Z' )
        },
        {
          '_id': 'act-mid',
          'updatedAt': new Date( '2025-10-27T12:00:00Z' )
        }
      ];

      mf.database.getAllActIds.mockResolvedValue( [ 'act-old', 'act-new', 'act-mid' ] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( mockActs );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.cacheSize ).toBe( 3 );
      expect( response.body.lastCacheUpdate.newest._id ).toBe( 'act-new' );
      expect( response.body.lastCacheUpdate.oldest._id ).toBe( 'act-old' );
    } );

    /**
     * Test acts without updatedAt are filtered out
     */
    test( 'filters out acts without updatedAt', async () => {
      const mockActs = [
        {
          '_id': 'act-with-date',
          'updatedAt': new Date( '2025-10-28T12:00:00Z' )
        },
        {
          '_id': 'act-no-date'
        }
      ];

      mf.database.getAllActIds.mockResolvedValue( [ 'act-with-date', 'act-no-date' ] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( mockActs );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.cacheSize ).toBe( 2 );
      expect( response.body.lastCacheUpdate.newest._id ).toBe( 'act-with-date' );
      expect( response.body.lastCacheUpdate.oldest._id ).toBe( 'act-with-date' );
    } );

    /**
     * Test uptime is a positive number
     */
    test( 'returns positive uptime value', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.uptime ).toBeGreaterThan( 0 );
      expect( typeof response.body.uptime ).toBe( 'number' );
    } );

    /**
     * Test usage stats structure
     */
    test( 'returns usage stats with correct structure', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      mf.usageStats.requests = 42;
      mf.usageStats.actsQueried = 123;

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.usageStats ).toEqual( {
        'requests': 42,
        'actsQueried': 123
      } );
    } );

    /**
     * Test response is pretty-printed JSON
     */
    test( 'returns pretty-printed JSON', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      // Pretty-printed JSON should contain newlines
      expect( JSON.stringify( response.body, null, 2 ) ).toContain( '\n' );
    } );

    /**
     * Test error handling when database throws
     */
    test( 'returns 500 when database throws error', async () => {
      mf.database.getAllActIds.mockRejectedValue( new Error( 'DB connection failed' ) );

      const response = await authenticatedRequest().expect( 500 );

      expect( response.body.error ).toBe( 'Failed to fetch health data' );
      expect( response.body.details ).toBe( 'DB connection failed' );
    } );
  } );

  describe( 'GET /admin/health - Artists without Bandsintown', () => {
    const validTotpConfig = {
      'secret': 'TESTSECRET',
      'encoding': 'base32',
      'algorithm': 'sha1'
    };
    const validPassword = 'testpass';
    let originalEnv;

    /**
     * Helper to make authenticated request
     * @returns {object} Supertest request with auth header
     */
    const authenticatedRequest = () => {
      const token = speakeasy.totp( validTotpConfig );
      return request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` );
    };

    beforeEach( () => {
      originalEnv = {
        'ADMIN_TOTP_CONFIG': process.env.ADMIN_TOTP_CONFIG,
        'ADMIN_PASS': process.env.ADMIN_PASS
      };

      process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );
      process.env.ADMIN_PASS = validPassword;

      mf.database.getAllActIds = jest.fn();
      mf.database.getAllActsWithMetadata = jest.fn();
      mf.database.getActsWithoutBandsintown = jest.fn();
      mf.database.getRecentUpdateErrors = jest.fn();
    } );

    afterEach( () => {
      process.env.ADMIN_TOTP_CONFIG = originalEnv.ADMIN_TOTP_CONFIG;
      process.env.ADMIN_PASS = originalEnv.ADMIN_PASS;
    } );

    /**
     * Test includes artistsWithoutBandsintown field
     */
    test( 'includes artistsWithoutBandsintown field in response', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body ).toHaveProperty( 'artistsWithoutBandsintown' );
      expect( Array.isArray( response.body.artistsWithoutBandsintown ) ).toBe( true );
    } );

    /**
     * Test returns empty array when all acts have bandsintown
     */
    test( 'returns empty array when all acts have bandsintown', async () => {
      mf.database.getAllActIds.mockResolvedValue( [ 'id1', 'id2' ] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.artistsWithoutBandsintown ).toEqual( [] );
    } );

    /**
     * Test returns array of MBIDs without bandsintown
     */
    test( 'returns array of MBIDs for acts without bandsintown', async () => {
      const mbidsWithoutBandsintown = [
        'mbid-without-1',
        'mbid-without-2',
        'mbid-without-3'
      ];

      mf.database.getAllActIds.mockResolvedValue( [ 'id1', 'id2', 'id3', 'id4', 'id5' ] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( mbidsWithoutBandsintown );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.artistsWithoutBandsintown ).toEqual( mbidsWithoutBandsintown );
      expect( mf.database.getActsWithoutBandsintown ).toHaveBeenCalledTimes( 1 );
    } );

    /**
     * Test calls getActsWithoutBandsintown function
     */
    test( 'calls getActsWithoutBandsintown to fetch data', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      await authenticatedRequest().expect( 200 );

      expect( mf.database.getActsWithoutBandsintown ).toHaveBeenCalled();
    } );

    /**
     * Test handles errors from getActsWithoutBandsintown
     */
    test( 'returns 500 when getActsWithoutBandsintown throws error', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockRejectedValue( new Error( 'Query failed' ) );

      const response = await authenticatedRequest().expect( 500 );

      expect( response.body.error ).toBe( 'Failed to fetch health data' );
      expect( response.body.details ).toBe( 'Query failed' );
    } );
  } );

  describe( 'GET /admin/health - Data Update Errors', () => {
    const validTotpConfig = {
      'secret': 'TESTSECRET',
      'encoding': 'base32',
      'algorithm': 'sha1'
    };
    const validPassword = 'testpass';
    let originalEnv;

    /**
     * Helper to make authenticated request
     * @returns {object} Supertest request with auth header
     */
    const authenticatedRequest = () => {
      const token = speakeasy.totp( validTotpConfig );
      return request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` );
    };

    beforeEach( () => {
      originalEnv = {
        'ADMIN_TOTP_CONFIG': process.env.ADMIN_TOTP_CONFIG,
        'ADMIN_PASS': process.env.ADMIN_PASS
      };

      process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );
      process.env.ADMIN_PASS = validPassword;

      mf.database.getAllActIds = jest.fn();
      mf.database.getAllActsWithMetadata = jest.fn();
      mf.database.getActsWithoutBandsintown = jest.fn();
      mf.database.getRecentUpdateErrors = jest.fn();
    } );

    afterEach( () => {
      process.env.ADMIN_TOTP_CONFIG = originalEnv.ADMIN_TOTP_CONFIG;
      process.env.ADMIN_PASS = originalEnv.ADMIN_PASS;
    } );

    /**
     * Test includes dataUpdateErrors field in response
     */
    test( 'includes dataUpdateErrors field in response', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );
      mf.database.getRecentUpdateErrors.mockResolvedValue( [] );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body ).toHaveProperty( 'dataUpdateErrors' );
      expect( Array.isArray( response.body.dataUpdateErrors ) ).toBe( true );
    } );

    /**
     * Test returns empty array when no errors
     */
    test( 'returns empty array when no update errors exist', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      mf.database.getRecentUpdateErrors.mockResolvedValue( [] );
      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.dataUpdateErrors ).toEqual( [] );
    } );

    /**
     * Test returns array of error objects
     */
    test( 'returns array of error objects from last 7 days', async () => {
      const mockErrors = [
        {
          'timestamp': getRecentBerlinTimestamp( 1 ),
          'actId': 'mbid-1',
          'errorMessage': 'MusicBrainz timeout',
          'errorSource': 'musicbrainz'
        },
        {
          'timestamp': getRecentBerlinTimestamp( 2 ),
          'actId': 'mbid-2',
          'errorMessage': 'Bandsintown not found',
          'errorSource': 'bandsintown'
        }
      ];

      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );
      mf.database.getRecentUpdateErrors.mockResolvedValue( mockErrors );

      const response = await authenticatedRequest().expect( 200 );

      expect( response.body.dataUpdateErrors ).toEqual( mockErrors );
      expect( response.body.dataUpdateErrors ).toHaveLength( 2 );
    } );

    /**
     * Test calls getRecentUpdateErrors function
     */
    test( 'calls getRecentUpdateErrors to fetch error data', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );

      await authenticatedRequest().expect( 200 );

      expect( mf.database.getRecentUpdateErrors ).toHaveBeenCalled();
    } );

    /**
     * Test handles errors from getRecentUpdateErrors
     */
    test( 'returns 500 when getRecentUpdateErrors throws error', async () => {
      mf.database.getAllActIds.mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata.mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown.mockResolvedValue( [] );
      mf.database.getRecentUpdateErrors.mockRejectedValue( new Error( 'Error query failed' ) );

      const response = await authenticatedRequest().expect( 500 );

      expect( response.body.error ).toBe( 'Failed to fetch health data' );
      expect( response.body.details ).toBe( 'Error query failed' );
    } );
  } );
} );
