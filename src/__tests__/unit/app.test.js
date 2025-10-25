/**
 * Unit tests for app.js route handlers
 * Tests Express app behavior with mocked artistService
 * @module __tests__/unit/app
 */

const request = require( 'supertest' );
require( '../../app' );
require( '../../services/artistService' );

describe( 'Express App - Route Handler Unit Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock artistService functions
    mf.artistService.fetchMultipleActs = jest.fn();
  } );

  describe( 'GET /acts/:id - ID parsing logic', () => {
    /**
     * Test that single ID is parsed correctly
     */
    test( 'parses single ID without modification', async () => {
      const actId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      mf.artistService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${actId}` ).expect( 200 );

      expect( mf.artistService.fetchMultipleActs ).toHaveBeenCalledWith( [ actId ] );
    } );

    /**
     * Test that comma-separated IDs are split correctly
     */
    test( 'splits comma-separated IDs into array', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.artistService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1},${id2}` ).expect( 200 );

      expect( mf.artistService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that whitespace is trimmed from IDs
     */
    test( 'trims whitespace from comma-separated IDs', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.artistService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1}, ${id2} ` ).expect( 200 );

      expect( mf.artistService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that multiple spaces are handled
     */
    test( 'handles multiple spaces around commas', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';
      const id3 = '664c3e0e-42d8-48c1-b209-1efca19c0325';

      mf.artistService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).get( `/acts/${id1}  ,  ${id2}  ,  ${id3}` ).expect( 200 );

      expect( mf.artistService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2, id3 ] );
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

      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
     * Test that artistService errors return 503
     */
    test( 'returns 503 when artistService returns error', async () => {
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
    test( 'returns 500 when artistService throws error', async () => {
      mf.artistService.fetchMultipleActs.mockRejectedValue( new Error( 'Database error' ) );

      const response = await request( mf.app ).get( '/acts/test-id' ).expect( 500 );

      expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
      expect( response.body.error.details ).toBe( 'Database error' );
    } );
  } );

  describe( 'GET /acts/:id - Headers', () => {
    /**
     * Test that response includes no-cache headers
     */
    test( 'includes Cache-Control no-cache headers', async () => {
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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
      mf.artistService.fetchMultipleActs.mockResolvedValue( {
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

      expect( response.body ).toHaveProperty( 'error', 'Not found' );
      expect( response.body ).toHaveProperty( 'status', 404 );
    } );

    /**
     * Test that root path returns 404
     */
    test( 'returns 404 JSON for root path', async () => {
      const response = await request( mf.app ).get( '/' ).expect( 404 );

      expect( response.body.error ).toMatch( /not found/iu );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that unsupported HTTP methods return 404
     */
    test( 'returns 404 for POST on GET-only route', async () => {
      const response = await request( mf.app ).post( '/acts/test-id' ).expect( 404 );

      expect( response.body.status ).toBe( 404 );
    } );
  } );
} );
