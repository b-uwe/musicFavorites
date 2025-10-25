/**
 * Tests for artistService.fetchMultipleActs with smart caching
 * @module __tests__/services/artistService.fetchMultiple
 */

const artistService = require( '../../services/artistService' );
const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fetchQueue = require( '../../services/fetchQueue' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );
jest.mock( '../../services/fetchQueue' );

describe( 'fetchMultipleActs', () => {
  let transformedTheKinks;
  let transformedVulvodynia;
  let transformedJungleRot;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );
    transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
  } );

  /**
   * Test invalid input handling
   */
  test( 'returns error for empty array', async () => {
    const result = await artistService.fetchMultipleActs( [] );

    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( 'Invalid input' );
  } );

  /**
   * Test invalid input handling - non-array
   */
  test( 'returns error for non-array input', async () => {
    const result = await artistService.fetchMultipleActs( 'not-an-array' );

    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( 'Invalid input' );
  } );

  /**
   * Test case 1: All acts cached
   */
  test( 'returns all acts immediately when all are cached', async () => {
    const actIds = [
      transformedTheKinks._id,
      transformedVulvodynia._id
    ];

    const cachedTheKinks = {
      'musicbrainzId': transformedTheKinks._id,
      ...transformedTheKinks
    };

    const cachedVulvodynia = {
      'musicbrainzId': transformedVulvodynia._id,
      ...transformedVulvodynia
    };

    database.getArtistFromCache.mockResolvedValueOnce( cachedTheKinks );
    database.getArtistFromCache.mockResolvedValueOnce( cachedVulvodynia );

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.acts ).toBeDefined();
    expect( result.acts ).toHaveLength( 2 );
    expect( result.acts[ 0 ] ).toEqual( cachedTheKinks );
    expect( result.acts[ 1 ] ).toEqual( cachedVulvodynia );
    expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
  } );

  /**
   * Test case 2: Exactly 1 act missing - fetch immediately
   */
  test( 'fetches immediately when exactly 1 act is missing', async () => {
    const actIds = [
      transformedTheKinks._id,
      transformedVulvodynia._id
    ];

    const cachedTheKinks = {
      'musicbrainzId': transformedTheKinks._id,
      ...transformedTheKinks
    };

    // First is cached, second is missing
    database.getArtistFromCache.mockResolvedValueOnce( cachedTheKinks );
    database.getArtistFromCache.mockResolvedValueOnce( null );

    musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockResolvedValue();

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.acts ).toBeDefined();
    expect( result.acts ).toHaveLength( 2 );
    expect( result.error ).not.toBeDefined();
    expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( transformedVulvodynia._id );
    expect( database.cacheArtist ).toHaveBeenCalled();
    expect( fetchQueue.processFetchQueue ).not.toHaveBeenCalled();
  } );

  /**
   * Test case 2: Single missing act gets cached after fetch
   */
  test( 'caches the freshly fetched act when 1 is missing', async () => {
    const actIds = [ transformedTheKinks._id ];

    database.getArtistFromCache.mockResolvedValue( null );
    musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockResolvedValue();

    await artistService.fetchMultipleActs( actIds );

    expect( database.cacheArtist ).toHaveBeenCalledWith( expect.objectContaining( {
      '_id': transformedTheKinks._id,
      'name': transformedTheKinks.name
    } ) );
  } );

  /**
   * Test case 3: 2+ acts missing - return error and trigger background fetch
   */
  test( 'returns error and triggers background fetch when 2+ acts missing', async () => {
    const actIds = [
      transformedTheKinks._id,
      transformedVulvodynia._id,
      transformedJungleRot._id
    ];

    // All missing
    database.getArtistFromCache.mockResolvedValue( null );
    fetchQueue.processFetchQueue.mockResolvedValue();

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( '3 acts not cached' );
    expect( result.error.message ).toContain( 'Background fetch initiated' );
    expect( result.error.missingCount ).toBe( 3 );
    expect( result.error.cachedCount ).toBe( 0 );
    expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    expect( fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( actIds );
  } );

  /**
   * Test case 3: Mixed cached and missing (2+ missing)
   */
  test( 'triggers background fetch when 2+ missing even with some cached', async () => {
    const actIds = [
      transformedTheKinks._id,
      transformedVulvodynia._id,
      transformedJungleRot._id
    ];

    const cachedTheKinks = {
      'musicbrainzId': transformedTheKinks._id,
      ...transformedTheKinks
    };

    // First cached, others missing
    database.getArtistFromCache.mockResolvedValueOnce( cachedTheKinks );
    database.getArtistFromCache.mockResolvedValueOnce( null );
    database.getArtistFromCache.mockResolvedValueOnce( null );

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.error ).toBeDefined();
    expect( result.error.missingCount ).toBe( 2 );
    expect( result.error.cachedCount ).toBe( 1 );
    expect( fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [
      transformedVulvodynia._id,
      transformedJungleRot._id
    ] );
  } );

  /**
   * Test that single missing act formats response correctly
   */
  test( 'formats response with musicbrainzId for single missing act', async () => {
    const actIds = [ transformedTheKinks._id ];

    database.getArtistFromCache.mockResolvedValue( null );
    musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockResolvedValue();

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.acts ).toBeDefined();
    expect( result.acts[ 0 ].musicbrainzId ).toBe( transformedTheKinks._id );
    expect( result.acts[ 0 ]._id ).not.toBeDefined();
  } );

  /**
   * Test cache failure handling for single missing act
   */
  test( 'continues when caching fails for single missing act', async () => {
    const actIds = [ transformedTheKinks._id ];

    database.getArtistFromCache.mockResolvedValue( null );
    musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

    const result = await artistService.fetchMultipleActs( actIds );

    expect( result.acts ).toBeDefined();
    expect( result.acts ).toHaveLength( 1 );
  } );
} );
