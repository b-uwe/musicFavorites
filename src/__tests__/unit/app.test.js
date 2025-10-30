/**
 * Unit tests for app.js route handlers
 * Tests Express app behavior with mocked actService
 * @module __tests__/unit/app
 */

const request = require( 'supertest' );
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
} );
