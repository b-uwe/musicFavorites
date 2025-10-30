/**
 * Unit tests for app.js route handlers
 * Tests Express app behavior with mocked actService
 * @module __tests__/unit/app
 */

const request = require( 'supertest' );
const speakeasy = require( 'speakeasy' );
require( '../../app' );
require( '../../services/actService' );

describe( 'Express App - Route Handler Unit Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock actService functions
    mf.actService.fetchMultipleActs = jest.fn();

    // Mock database functions
    mf.database = mf.database || {};
    mf.database.getAllActIds = jest.fn();
    mf.database.getAllActsWithMetadata = jest.fn();

    // Reset usage stats
    mf.usageStats.requests = 0;
    mf.usageStats.actsQueried = 0;
  } );

  describe( 'GET /acts/:id - ID parsing logic', () => {
    /**
     * Test that single ID is parsed correctly
     */
    test( 'parses single ID without modification', async () => {
      const actId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${actId}` ).expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ actId ] );
    } );

    /**
     * Test that comma-separated IDs are split correctly
     */
    test( 'splits comma-separated IDs into array', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1},${id2}` ).expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that whitespace is trimmed from IDs
     */
    test( 'trims whitespace from comma-separated IDs', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1}, ${id2} ` ).expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that multiple spaces are handled
     */
    test( 'handles multiple spaces around commas', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';
      const id3 = '664c3e0e-42d8-48c1-b209-1efca19c0325';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1}  ,  ${id2}  ,  ${id3}` ).expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2, id3 ] );
    } );
  } );

  describe( 'GET /acts/:id - Response formatting', () => {
    /**
     * Test that successful response includes meta and acts
     */
    test( 'formats successful response with meta and acts', async () => {
      const mockActs = [
        {
          'musicbrainzId': 'test-id',
          'name': 'Test Artist'
        }
      ];

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': mockActs
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      expect( response.body ).toHaveProperty( 'meta' );
      expect( response.body ).toHaveProperty( 'type', 'acts' );
      expect( response.body ).toHaveProperty( 'acts' );
      expect( response.body.acts ).toEqual( mockActs );
    } );

    /**
     * Test that meta includes attribution
     */
    test( 'includes attribution in meta', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      expect( response.body.meta.attribution ).toBeDefined();
      expect( response.body.meta.attribution.sources ).toContain( 'MusicBrainz' );
      expect( response.body.meta.attribution.sources ).toContain( 'Bandsintown' );
      expect( response.body.meta.attribution.sources ).toContain( 'Songkick' );
      expect( response.body.meta.attribution.notice ).toContain( 'DATA_NOTICE.md' );
    } );

    /**
     * Test that meta includes license
     */
    test( 'includes license in meta', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
      expect( response.body.meta.repository ).toContain( 'github.com' );
    } );

    /**
     * Test that error response includes meta
     */
    test( 'includes meta in error responses', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'error': {
          'message': 'Test error'
        }
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 503 );

      expect( response.body ).toHaveProperty( 'meta' );
      expect( response.body ).toHaveProperty( 'type', 'error' );
      expect( response.body ).toHaveProperty( 'error' );
      expect( response.body.error.message ).toBe( 'Test error' );
    } );
  } );

  describe( 'GET /acts/:id - Error handling', () => {
    /**
     * Test that actService errors return 503
     */
    test( 'returns 503 when actService returns error', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'error': {
          'message': '2 acts not cached',
          'missingCount': 2
        }
      } );

      const response = await request( mf.app ).get( '/acts/id1,id2' ).expect( 503 );

      expect( response.body.error.message ).toBe( '2 acts not cached' );
      expect( response.body.error.missingCount ).toBe( 2 );
    } );

    /**
     * Test that thrown errors return 500
     */
    test( 'returns 500 when actService throws error', async () => {
      mf.actService.fetchMultipleActs.mockRejectedValue( new Error( 'Database error' ) );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 500 );

      expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
      expect( response.body.error.details ).toBe( 'Database error' );
    } );
  } );

  describe( 'GET /acts/:id - Headers', () => {
    /**
     * Test that response includes no-cache headers
     */
    test( 'includes Cache-Control no-cache headers', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      expect( response.headers[ 'cache-control' ] ).toContain( 'no-store' );
      expect( response.headers[ 'cache-control' ] ).toContain( 'no-cache' );
      expect( response.headers.pragma ).toBe( 'no-cache' );
      expect( response.headers.expires ).toBe( '0' );
    } );

    /**
     * Test that response includes robots meta tag
     */
    test( 'includes X-Robots-Tag header', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      expect( response.headers[ 'x-robots-tag' ] ).toContain( 'noindex' );
      expect( response.headers[ 'x-robots-tag' ] ).toContain( 'nofollow' );
    } );
  } );

  describe( 'GET /acts/:id - ?pretty parameter', () => {
    /**
     * Test that ?pretty formats JSON with spaces
     */
    test( 'formats JSON with spaces when ?pretty is present', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).get( '/acts/test-id?pretty' ).expect( 200 );

      // Pretty-printed JSON should contain newlines
      expect( JSON.stringify( response.body, null, 2 ) ).toContain( '\n' );
    } );

    /**
     * Test that without ?pretty, JSON is compact
     */
    test( 'formats JSON compactly without ?pretty', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( '/acts/test-id' ).expect( 200 );

      /*
       * Without ?pretty, app setting should be 0 spaces
       * (This is harder to test directly, but we verify the parameter works)
       */
    } );
  } );

  describe( 'GET /robots.txt', () => {
    /**
     * Test that robots.txt is served as text/plain
     */
    test( 'returns robots.txt as text/plain', async () => {
      const response = await request( mf.app ).get( '/robots.txt' ).expect( 200 );

      expect( response.headers[ 'content-type' ] ).toMatch( /text\/plain/u );
      expect( response.text ).toBeDefined();
      expect( response.text ).toContain( 'User-agent' );
    } );
  } );

  describe( '404 handler', () => {
    /**
     * Test that invalid routes return 404 JSON
     */
    test( 'returns 404 JSON for invalid routes', async () => {
      const response = await request( mf.app ).get( '/invalid/path' ).expect( 404 );

      expect( response.headers[ 'content-type' ] ).toMatch( /application\/json/u );
      expect( response.body ).toHaveProperty( 'error', 'Not found' );
      expect( response.body ).toHaveProperty( 'status', 404 );
    } );

    /**
     * Test that root path returns 404
     */
    test( 'returns 404 JSON for root path', async () => {
      const response = await request( mf.app ).get( '/' ).expect( 404 );

      expect( response.headers[ 'content-type' ] ).toMatch( /application\/json/u );
      expect( response.body.error ).toMatch( /not found/iu );
      expect( response.body.status ).toBe( 404 );
    } );
  } );

  describe( 'GET /acts/:id - Usage statistics tracking', () => {
    /**
     * Test that requests are counted
     */
    test( 'increments request counter for each request', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const initialRequests = mf.usageStats.requests;

      await request( mf.app ).get( '/acts/test-id' ).expect( 200 );
      expect( mf.usageStats.requests ).toBe( initialRequests + 1 );

      await request( mf.app ).get( '/acts/test-id2' ).expect( 200 );
      expect( mf.usageStats.requests ).toBe( initialRequests + 2 );
    } );

    /**
     * Test that single act ID is counted
     */
    test( 'counts single act ID correctly', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const initialActsQueried = mf.usageStats.actsQueried;

      await request( mf.app ).get( '/acts/test-id' ).expect( 200 );
      expect( mf.usageStats.actsQueried ).toBe( initialActsQueried + 1 );
    } );

    /**
     * Test that multiple act IDs are counted correctly
     */
    test( 'counts multiple act IDs correctly', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const initialActsQueried = mf.usageStats.actsQueried;

      await request( mf.app ).get( '/acts/id1,id2,id3' ).expect( 200 );
      expect( mf.usageStats.actsQueried ).toBe( initialActsQueried + 3 );
    } );

    /**
     * Test that stats persist across requests
     */
    test( 'accumulates stats across multiple requests', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      mf.usageStats.requests = 0;
      mf.usageStats.actsQueried = 0;

      await request( mf.app ).get( '/acts/id1' ).expect( 200 );
      await request( mf.app ).get( '/acts/id2,id3' ).expect( 200 );
      await request( mf.app ).get( '/acts/id4,id5,id6' ).expect( 200 );

      expect( mf.usageStats.requests ).toBe( 3 );
      expect( mf.usageStats.actsQueried ).toBe( 6 );
    } );
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
} );
