/**
 * Integration tests for upstream API error handling
 * Tests: Handling 429, 503, timeouts from MusicBrainz and Bandsintown
 * Mocks: External I/O with error scenarios
 * @module __tests__/integration/upstreamErrors.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/artistService' );
require( '../../app' );

describe( 'Upstream API Error Handling Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset fetch queue state
    mf.testing.fetchQueue.fetchQueue.clear();
    mf.testing.fetchQueue.setIsRunning( false );

    // Default mocks
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  /**
   * Test MusicBrainz 429 rate limit error - user perspective
   */
  test( 'MusicBrainz 429 rate limit error returns 500 to user', async () => {
    const rateLimitError = new Error( 'MusicBrainz API error: Rate limit exceeded' );

    rateLimitError.statusCode = 429;
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( rateLimitError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    // Should return error with details
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test MusicBrainz 503 service unavailable - user perspective
   */
  test( 'MusicBrainz 503 service unavailable returns 500 to user', async () => {
    const serviceError = new Error( 'MusicBrainz API error: Service temporarily unavailable' );

    serviceError.statusCode = 503;
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( serviceError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test Bandsintown timeout during LD+JSON extraction
   */
  test( 'Bandsintown timeout is handled without crashing', async () => {
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );

    const timeoutError = new Error( 'Request timeout after 30s' );

    timeoutError.code = 'ETIMEDOUT';
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( timeoutError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // MusicBrainz fetch should succeed
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();

    // Cache should still happen (even without Bandsintown events)
    expect( mf.database.cacheArtist ).toHaveBeenCalled();
  } );

  /**
   * Test network error during MusicBrainz fetch - user perspective
   */
  test( 'network error during MusicBrainz fetch returns 500 to user', async () => {
    const networkError = new Error( 'MusicBrainz API error: ECONNREFUSED' );

    networkError.code = 'ECONNREFUSED';
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( networkError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test DNS resolution failure - user perspective
   */
  test( 'DNS resolution failure returns 500 to user', async () => {
    const dnsError = new Error( 'MusicBrainz API error: getaddrinfo ENOTFOUND musicbrainz.org' );

    dnsError.code = 'ENOTFOUND';
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( dnsError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test MusicBrainz returns malformed JSON - user perspective
   */
  test( 'malformed JSON from MusicBrainz returns 500 to user', async () => {
    const parseError = new Error( 'MusicBrainz API error: Unexpected token < in JSON at position 0' );

    parseError.name = 'SyntaxError';
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( parseError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test partial success: MusicBrainz succeeds, Bandsintown fails
   */
  test( 'partial success with Bandsintown failure still caches data', async () => {
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Bandsintown down' ) );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should still cache with empty events
    expect( mf.database.cacheArtist ).toHaveBeenCalled();

    const [ [ cachedData ] ] = mf.database.cacheArtist.mock.calls;

    expect( cachedData._id ).toBe( fixtureTheKinks.id );
    expect( cachedData.events ).toEqual( [] );
  } );

  /**
   * Test multiple concurrent rate limit errors
   */
  test( 'multiple concurrent rate limit errors are handled', async () => {
    const rateLimitError = new Error( 'Rate limit exceeded' );

    rateLimitError.statusCode = 429;
    mf.musicbrainz.fetchArtist.mockRejectedValue( rateLimitError );

    const actIds = [
      'act1',
      'act2',
      'act3'
    ];

    mf.fetchQueue.triggerBackgroundFetch( actIds );

    await jest.advanceTimersByTimeAsync( 95000 );

    // All should attempt but all fail
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledTimes( 3 );
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test Bandsintown returns HTML instead of LD+JSON
   */
  test( 'Bandsintown HTML response without LD+JSON is handled', async () => {
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );

    // Empty array means no LD+JSON found
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should cache with empty events
    expect( mf.database.cacheArtist ).toHaveBeenCalled();

    const [ [ cachedData ] ] = mf.database.cacheArtist.mock.calls;

    expect( cachedData.events ).toEqual( [] );
  } );

  /**
   * Test SSL certificate error - user perspective
   */
  test( 'SSL certificate error returns 500 to user', async () => {
    const sslError = new Error( 'MusicBrainz API error: unable to verify the first certificate' );

    sslError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( sslError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test HTTP redirect loop
   */
  test( 'HTTP redirect loop error is handled', async () => {
    const redirectError = new Error( 'Maximum redirect reached' );

    redirectError.code = 'ERR_TOO_MANY_REDIRECTS';
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( redirectError );
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureTheKinks );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should still cache MusicBrainz data
    expect( mf.database.cacheArtist ).toHaveBeenCalled();
  } );

  /**
   * Test upstream API returns 404 for valid request - user perspective
   */
  test( 'MusicBrainz 404 for existing artist returns 500 to user', async () => {
    const notFoundError = new Error( 'MusicBrainz API error: Artist not found' );

    notFoundError.statusCode = 404;
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( notFoundError );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );

  /**
   * Test cache miss with upstream error returns proper error to user
   */
  test( 'cache miss with upstream error returns 500 to user', async () => {
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( new Error( 'MusicBrainz API error: Rate limited' ) );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
    expect( response.body.error.details ).toBeDefined();
  } );
} );
