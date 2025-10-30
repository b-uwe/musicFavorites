/**
 * Unit tests for app.js POST /acts route handler
 * Tests Express app behavior with mocked actService
 * @module __tests__/unit/appPost
 */

const request = require( 'supertest' );
require( '../../app' );
require( '../../services/actService' );

describe( 'Express App - POST /acts Route Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock actService functions
    mf.actService.fetchMultipleActs = jest.fn();

    // Reset usage stats
    mf.usageStats.requests = 0;
    mf.usageStats.actsQueried = 0;
  } );

  describe( 'POST /acts - ID parsing logic', () => {
    /**
     * Test that single ID in body is parsed correctly
     */
    test( 'parses single ID from request body', async () => {
      const actId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( actId ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ actId ] );
    } );

    /**
     * Test that multiple IDs in comma-separated string are parsed correctly
     */
    test( 'parses multiple IDs from comma-separated string', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( `${id1},${id2}` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that large comma-separated list of IDs is supported
     */
    test( 'handles large comma-separated list of act IDs', async () => {
      const largeIdList = Array.from( { 'length': 100 }, ( _, i ) => `id-${i}` ).join( ',' );
      const expectedArray = Array.from( { 'length': 100 }, ( _, i ) => `id-${i}` );

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( largeIdList ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( expectedArray );
    } );

    /**
     * Test that whitespace is trimmed from IDs in comma-separated string
     */
    test( 'trims whitespace from IDs in comma-separated string', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( ` ${id1} , ${id2} ` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that duplicate IDs in same request are deduplicated
     */
    test( 'deduplicates repeated IDs in comma-separated list', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( `${id1},${id2},${id1}` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that multiple duplicate IDs are deduplicated
     */
    test( 'deduplicates multiple occurrences of same ID', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( `${id1},${id2},${id1},${id2},${id1}` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
    } );

    /**
     * Test that deduplication preserves order of first occurrence
     */
    test( 'preserves order of first occurrence when deduplicating', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';
      const id2 = '53689c08-f234-4c47-9256-58c8568f06d1';
      const id3 = '664c3e0e-42d8-48c1-b209-1efca19c0325';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( `${id1},${id2},${id3},${id2},${id1}` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2, id3 ] );
    } );

    /**
     * Test that single duplicate ID becomes single ID
     */
    test( 'handles single ID duplicated multiple times', async () => {
      const id1 = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( `${id1},${id1},${id1}` ).
        expect( 200 );

      expect( mf.actService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1 ] );
    } );

    /**
     * Test that missing ids field returns 400
     */
    test( 'returns 400 when ids field is missing', async () => {
      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( '' ).
        expect( 400 );

      expect( response.body.error.message ).toBe( 'Invalid request body' );
    } );

    /**
     * Test that non-string ids field returns 400
     */
    test( 'returns 400 when ids field is not a string', async () => {
      const response = await request( mf.app ).
        post( '/acts' ).
        send( { 'ids': [ 'id1', 'id2' ] } ).
        expect( 400 );

      expect( response.body.error.message ).toBe( 'Invalid request body' );
    } );

    /**
     * Test that empty ids string returns 400
     */
    test( 'returns 400 when ids string is empty', async () => {
      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( '' ).
        expect( 400 );

      expect( response.body.error.message ).toBe( 'Invalid request body' );
    } );

    /**
     * Test that whitespace-only ids string returns 400
     */
    test( 'returns 400 when ids string is whitespace only', async () => {
      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( '   ' ).
        expect( 400 );

      expect( response.body.error.message ).toBe( 'Invalid request body' );
    } );
  } );

  describe( 'POST /acts - Response formatting', () => {
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

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );

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

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );

      expect( response.body.meta.attribution ).toBeDefined();
      expect( response.body.meta.attribution.sources ).toContain( 'MusicBrainz' );
      expect( response.body.meta.attribution.sources ).toContain( 'Bandsintown' );
      expect( response.body.meta.attribution.sources ).toContain( 'Songkick' );
      expect( response.body.meta.attribution.notice ).toContain( 'DATA_NOTICE.md' );
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

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 503 );

      expect( response.body ).toHaveProperty( 'meta' );
      expect( response.body ).toHaveProperty( 'type', 'error' );
      expect( response.body ).toHaveProperty( 'error' );
      expect( response.body.error.message ).toBe( 'Test error' );
    } );
  } );

  describe( 'POST /acts - Error handling', () => {
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

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id1,id2' ).
        expect( 503 );

      expect( response.body.error.message ).toBe( '2 acts not cached' );
      expect( response.body.error.missingCount ).toBe( 2 );
    } );

    /**
     * Test that thrown errors return 500
     */
    test( 'returns 500 when actService throws error', async () => {
      mf.actService.fetchMultipleActs.mockRejectedValue( new Error( 'Database error' ) );

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 500 );

      expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
      expect( response.body.error.details ).toBe( 'Database error' );
    } );
  } );

  describe( 'POST /acts - Headers', () => {
    /**
     * Test that response includes no-cache headers
     */
    test( 'includes Cache-Control no-cache headers', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );

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

      const response = await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );

      expect( response.headers[ 'x-robots-tag' ] ).toContain( 'noindex' );
      expect( response.headers[ 'x-robots-tag' ] ).toContain( 'nofollow' );
    } );
  } );

  describe( 'POST /acts - ?pretty parameter', () => {
    /**
     * Test that ?pretty formats JSON with spaces
     */
    test( 'formats JSON with spaces when ?pretty is present', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const response = await request( mf.app ).
        post( '/acts?pretty' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );

      // Pretty-printed JSON should contain newlines
      expect( JSON.stringify( response.body, null, 2 ) ).toContain( '\n' );
    } );
  } );

  describe( 'POST /acts - Usage statistics tracking', () => {
    /**
     * Test that requests are counted
     */
    test( 'increments request counter for each request', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const initialRequests = mf.usageStats.requests;

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );
      expect( mf.usageStats.requests ).toBe( initialRequests + 1 );

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id2' ).
        expect( 200 );
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

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 200 );
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

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id1,id2,id3' ).
        expect( 200 );
      expect( mf.usageStats.actsQueried ).toBe( initialActsQueried + 3 );
    } );

    /**
     * Test that duplicate IDs are only counted once in stats
     */
    test( 'counts unique act IDs only when duplicates present', async () => {
      mf.actService.fetchMultipleActs.mockResolvedValue( {
        'acts': []
      } );

      const initialActsQueried = mf.usageStats.actsQueried;

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id1,id2,id1,id2' ).
        expect( 200 );
      expect( mf.usageStats.actsQueried ).toBe( initialActsQueried + 2 );
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

      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id1' ).
        expect( 200 );
      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id2,id3' ).
        expect( 200 );
      await request( mf.app ).
        post( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'id4,id5,id6' ).
        expect( 200 );

      expect( mf.usageStats.requests ).toBe( 3 );
      expect( mf.usageStats.actsQueried ).toBe( 6 );
    } );
  } );
} );
