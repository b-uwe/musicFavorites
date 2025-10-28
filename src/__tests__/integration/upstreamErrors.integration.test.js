/**
 * Integration tests for upstream API error handling
 * Tests: Handling 429, 503, timeouts from MusicBrainz and Bandsintown
 * Mocks: Only external I/O (mongodb for database, axios for HTTP)
 * @module __tests__/integration/upstreamErrors.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'axios' );
jest.mock( 'mongodb' );

const axios = require( 'axios' );

// Load integration test setup helper
require( '../../testHelpers/integrationTestSetup' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/actService' );
require( '../../app' );

describe( 'Upstream API Error Handling Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    const setup = await mf.testing.integrationTestSetup.setupIntegrationTest( {
      'fetchQueueTestingApi': mf.testing.fetchQueue,
      'useFakeTimers': true
    } );

    ( { mockCollection } = setup );
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  /**
   * Test MusicBrainz 429 rate limit error - user perspective
   */
  test( 'MusicBrainz 429 rate limit error returns 500 to user', async () => {
    const rateLimitError = new Error( 'Request failed with status code 429' );

    rateLimitError.response = { 'status': 429 };

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with rate limit error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( rateLimitError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    // Should return error with details
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test MusicBrainz 503 service unavailable - user perspective
   */
  test( 'MusicBrainz 503 service unavailable returns 500 to user', async () => {
    const serviceError = new Error( 'Request failed with status code 503' );

    serviceError.response = { 'status': 503 };

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with 503 error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( serviceError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test Bandsintown timeout during LD+JSON extraction
   */
  test( 'Bandsintown timeout is handled without crashing', async () => {
    const timeoutError = new Error( 'timeout of 30000ms exceeded' );

    timeoutError.code = 'ETIMEDOUT';

    // Axios succeeds for MusicBrainz, fails for Bandsintown
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        return Promise.reject( timeoutError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // MusicBrainz fetch should succeed via axios
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBeGreaterThan( 0 );

    // Cache should still happen (even without Bandsintown events)
    expect( mockCollection.updateOne ).toHaveBeenCalled();
  } );

  /**
   * Test network error during MusicBrainz fetch - user perspective
   */
  test( 'network error during MusicBrainz fetch returns 500 to user', async () => {
    const networkError = new Error( 'connect ECONNREFUSED 127.0.0.1:80' );

    networkError.code = 'ECONNREFUSED';

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with network error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( networkError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test DNS resolution failure - user perspective
   */
  test( 'DNS resolution failure returns 500 to user', async () => {
    const dnsError = new Error( 'getaddrinfo ENOTFOUND musicbrainz.org' );

    dnsError.code = 'ENOTFOUND';

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with DNS error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( dnsError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test MusicBrainz returns malformed JSON - user perspective
   */
  test( 'malformed JSON from MusicBrainz returns 500 to user', async () => {
    const parseError = new Error( 'Unexpected token < in JSON at position 0' );

    parseError.name = 'SyntaxError';

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with parse error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( parseError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test partial success: MusicBrainz succeeds, Bandsintown fails
   */
  test( 'partial success with Bandsintown failure still caches data', async () => {
    // Axios succeeds for MusicBrainz, fails for Bandsintown
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        return Promise.reject( new Error( 'Bandsintown down' ) );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should still cache with empty events
    expect( mockCollection.updateOne ).toHaveBeenCalled();

    const updateCall = mockCollection.updateOne.mock.calls.find( ( call ) => call[ 0 ]._id === fixtureTheKinks.id );

    expect( updateCall ).toBeDefined();
    expect( updateCall[ 1 ].$set.events ).toEqual( [] );
  } );

  /**
   * Test multiple concurrent rate limit errors
   */
  test( 'multiple concurrent rate limit errors are handled', async () => {
    const rateLimitError = new Error( 'Request failed with status code 429' );

    rateLimitError.response = { 'status': 429 };

    // Axios rejects all MusicBrainz calls with rate limit
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( rateLimitError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const actIds = [
      'act1',
      'act2',
      'act3'
    ];

    mf.fetchQueue.triggerBackgroundFetch( actIds );

    await jest.advanceTimersByTimeAsync( 95000 );

    // All should attempt but all fail
    const musicbrainzCalls = axios.get.mock.calls.filter( ( call ) => call[ 0 ].includes( 'musicbrainz.org' ) );

    expect( musicbrainzCalls.length ).toBe( 3 );
    expect( mockCollection.updateOne ).not.toHaveBeenCalled();
  } );

  /**
   * Test Bandsintown returns HTML instead of LD+JSON
   */
  test( 'Bandsintown HTML response without LD+JSON is handled', async () => {
    // Axios succeeds for MusicBrainz, returns HTML (no LD+JSON) for Bandsintown
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        // HTML without LD+JSON blocks
        return Promise.resolve( { 'data': '<html><body>No events</body></html>' } );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should cache with empty events
    expect( mockCollection.updateOne ).toHaveBeenCalled();

    const updateCall = mockCollection.updateOne.mock.calls.find( ( call ) => call[ 0 ]._id === fixtureTheKinks.id );

    expect( updateCall ).toBeDefined();
    expect( updateCall[ 1 ].$set.events ).toEqual( [] );
  } );

  /**
   * Test SSL certificate error - user perspective
   */
  test( 'SSL certificate error returns 500 to user', async () => {
    const sslError = new Error( 'unable to verify the first certificate' );

    sslError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with SSL error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( sslError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test HTTP redirect loop
   */
  test( 'HTTP redirect loop error is handled', async () => {
    const redirectError = new Error( 'Maximum redirect reached' );

    redirectError.code = 'ERR_TOO_MANY_REDIRECTS';

    // Axios succeeds for MusicBrainz, fails with redirect loop for Bandsintown
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureTheKinks } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        return Promise.reject( redirectError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should still cache MusicBrainz data
    expect( mockCollection.updateOne ).toHaveBeenCalled();
  } );

  /**
   * Test upstream API returns 404 for valid request - user perspective
   */
  test( 'MusicBrainz 404 for existing artist returns 500 to user', async () => {
    const notFoundError = new Error( 'Request failed with status code 404' );

    notFoundError.response = { 'status': 404 };

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with 404 error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( notFoundError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test cache miss with upstream error returns proper error to user
   */
  test( 'cache miss with upstream error returns 500 to user', async () => {
    const rateLimitError = new Error( 'Request failed with status code 429' );

    rateLimitError.response = { 'status': 429 };

    // MongoDB returns null (cache miss)
    mockCollection.findOne.mockResolvedValue( null );

    // Axios rejects with rate limit error for MusicBrainz
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.reject( rateLimitError );
      }

      return Promise.resolve( { 'data': '' } );
    } );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch act data' );
    expect( response.body.error.details ).toBeDefined();
  } );
} );
