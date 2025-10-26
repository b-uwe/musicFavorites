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
   * Test MusicBrainz 429 rate limit error
   */
  test( 'MusicBrainz 429 rate limit error is handled gracefully', async () => {
    const rateLimitError = new Error( 'Rate limit exceeded' );

    rateLimitError.statusCode = 429;
    mf.musicbrainz.fetchArtist.mockRejectedValue( rateLimitError );

    // Trigger background fetch
    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    // Should not crash, just log error
    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test MusicBrainz 503 service unavailable
   */
  test( 'MusicBrainz 503 service unavailable is handled', async () => {
    const serviceError = new Error( 'Service temporarily unavailable' );

    serviceError.statusCode = 503;
    mf.musicbrainz.fetchArtist.mockRejectedValue( serviceError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
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
   * Test network error during MusicBrainz fetch
   */
  test( 'network error during MusicBrainz fetch is handled', async () => {
    const networkError = new Error( 'ECONNREFUSED' );

    networkError.code = 'ECONNREFUSED';
    mf.musicbrainz.fetchArtist.mockRejectedValue( networkError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test DNS resolution failure
   */
  test( 'DNS resolution failure is handled gracefully', async () => {
    const dnsError = new Error( 'getaddrinfo ENOTFOUND musicbrainz.org' );

    dnsError.code = 'ENOTFOUND';
    mf.musicbrainz.fetchArtist.mockRejectedValue( dnsError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
  } );

  /**
   * Test MusicBrainz returns malformed JSON
   */
  test( 'malformed JSON from MusicBrainz is handled', async () => {
    const parseError = new Error( 'Unexpected token < in JSON at position 0' );

    parseError.name = 'SyntaxError';
    mf.musicbrainz.fetchArtist.mockRejectedValue( parseError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
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
   * Test SSL certificate error
   */
  test( 'SSL certificate error is handled gracefully', async () => {
    const sslError = new Error( 'unable to verify the first certificate' );

    sslError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    mf.musicbrainz.fetchArtist.mockRejectedValue( sslError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
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
   * Test upstream API returns 404 for valid request
   */
  test( 'MusicBrainz 404 for existing artist is handled', async () => {
    const notFoundError = new Error( 'Artist not found' );

    notFoundError.statusCode = 404;
    mf.musicbrainz.fetchArtist.mockRejectedValue( notFoundError );

    mf.fetchQueue.triggerBackgroundFetch( [ fixtureTheKinks.id ] );

    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.database.cacheArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test API request via HTTP when called from user
   */
  test( 'cached miss triggers background fetch despite upstream errors', async () => {
    mf.database.getArtistFromCache.mockResolvedValue( null );
    mf.musicbrainz.fetchArtist.mockRejectedValue( new Error( 'Rate limited' ) );

    const response = await request( mf.app ).get( `/acts/${fixtureTheKinks.id}` );

    // Should return error immediately
    expect( response.status ).toBeGreaterThanOrEqual( 500 );

    // Background fetch should be triggered
    await jest.advanceTimersByTimeAsync( 35000 );

    expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalled();
  } );
} );
