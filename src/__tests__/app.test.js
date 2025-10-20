/**
 * Tests for the Music Favorites API
 */

const request = require( 'supertest' );
const app = require( '../app' );
const artistService = require( '../services/artistService' );
const musicbrainzTransformer = require( '../services/musicbrainzTransformer' );
const fixtureJungleRot = require( './fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( './fixtures/musicbrainz-the-kinks.json' );
const fixtureMiseryIndex = require( './fixtures/musicbrainz-misery-index.json' );
const fixtureWatain = require( './fixtures/musicbrainz-watain.json' );

jest.mock( '../services/artistService' );

// Transform fixtures to output format
const transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
const transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
const transformedMiseryIndex = musicbrainzTransformer.transformArtistData( fixtureMiseryIndex );
const transformedWatain = musicbrainzTransformer.transformArtistData( fixtureWatain );

describe( 'GET /acts/:id - Basic functionality', () => {
  /**
   * Test basic acts endpoint response structure
   */
  test( 'returns acts array with valid MusicBrainz UUID', async () => {
    const actId = transformedJungleRot.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedJungleRot );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    expect( response.body.type ).toBe( 'acts' );
    expect( Array.isArray( response.body.acts ) ).toBe( true );
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( actId );
  } );

  /**
   * Test with different UUID
   */
  test( 'returns acts data with different MusicBrainz UUID', async () => {
    const actId = transformedTheKinks.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedTheKinks );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    expect( response.body.type ).toBe( 'acts' );
    expect( Array.isArray( response.body.acts ) ).toBe( true );
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ].musicbrainzId ).toBe( actId );
  } );

  /**
   * Test invalid route handling
   */
  test( 'returns 404 for invalid route', async () => {
    const actId = transformedJungleRot.musicbrainzId;

    await request( app ).
      get( `/invalid/${actId}` ).
      expect( 404 );
  } );
} );

describe( 'Error handling - JSON responses', () => {
  /**
   * Test JSON error for invalid route
   */
  test( 'returns JSON error for invalid route', async () => {
    const response = await request( app ).
      get( '/invalid/path' ).
      expect( 404 ).
      expect( 'Content-Type', /json/u );

    expect( response.body ).toHaveProperty( 'error' );
    expect( response.body ).toHaveProperty( 'status' );
    expect( response.body.status ).toBe( 404 );
    expect( response.body.error ).toMatch( /not found/iu );
  } );

  /**
   * Test JSON error for invalid HTTP method
   */
  test( 'returns JSON error for unsupported HTTP method', async () => {
    const response = await request( app ).
      post( '/acts/53689c08-f234-4c47-9256-58c8568f06d1' ).
      expect( 404 ).
      expect( 'Content-Type', /json/u );

    expect( response.body ).toHaveProperty( 'error' );
    expect( response.body.status ).toBe( 404 );
  } );

  /**
   * Test JSON error for root path
   */
  test( 'returns JSON error for root path', async () => {
    const response = await request( app ).
      get( '/' ).
      expect( 404 ).
      expect( 'Content-Type', /json/u );

    expect( response.body ).toHaveProperty( 'error' );
    expect( response.body.status ).toBe( 404 );
  } );
} );

describe( 'GET /robots.txt', () => {
  /**
   * Test robots.txt serves plain text
   */
  test( 'returns robots.txt as text/plain', async () => {
    const response = await request( app ).
      get( '/robots.txt' ).
      expect( 200 );

    expect( response.headers[ 'content-type' ] ).toMatch( /text\/plain/u );
    expect( response.text ).toBeDefined();
    expect( response.text ).toContain( 'User-agent' );
  } );
} );

describe( 'GET /acts/:id - Error handling', () => {
  /**
   * Test error handling for invalid MusicBrainz ID
   */
  test( 'returns 500 error for invalid MusicBrainz ID', async () => {
    const invalidId = 'invalid-id-format';

    artistService.getArtist.mockRejectedValue( new Error( 'Invalid artist ID format' ) );

    const response = await request( app ).
      get( `/acts/${invalidId}` ).
      expect( 500 );

    expect( response.body.type ).toBe( 'error' );
    expect( response.body.error ).toBeDefined();
    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
  } );
} );

describe( 'GET /acts/:id - Response metadata', () => {
  /**
   * Test that meta is the first property in response
   */
  test( 'meta is the first property in JSON response', async () => {
    const actId = transformedMiseryIndex.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedMiseryIndex );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    const [ firstKey ] = Object.keys( response.body );

    expect( firstKey ).toBe( 'meta' );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );

  /**
   * Test attribution information
   */
  test( 'response includes attribution information', async () => {
    const actId = transformedMiseryIndex.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedMiseryIndex );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    expect( response.body.meta.attribution ).toHaveProperty( 'sources' );
    expect( response.body.meta.attribution ).toHaveProperty( 'notice' );
    expect( response.body.meta.attribution.sources ).
      toEqual( expect.arrayContaining( [ 'MusicBrainz', 'Bandsintown', 'Songkick' ] ) );
  } );
} );

describe( 'GET /acts/:id - Response license', () => {
  /**
   * Test metadata fields
   */
  test( 'response includes metadata', async () => {
    const actId = transformedWatain.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedWatain );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    expect( response.body.meta ).toHaveProperty( 'license' );
    expect( response.body.meta ).toHaveProperty( 'repository' );
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );
} );

describe( 'GET /acts/:id - JSON formatting', () => {
  /**
   * Test default JSON response is compact (one-liner)
   */
  test( 'response is compact JSON by default', async () => {
    const actId = transformedMiseryIndex.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedMiseryIndex );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    // Get raw response text
    const rawText = response.text;

    // Compact JSON should not have newlines (except potentially at the very end)
    const trimmedText = rawText.trim();

    expect( trimmedText ).not.toMatch( /\{\s*\n/u );
    expect( trimmedText ).not.toContain( '\n  ' );
  } );

  /**
   * Test ?pretty query parameter returns beautified JSON
   */
  test( 'response is beautified with ?pretty query parameter', async () => {
    const actId = transformedMiseryIndex.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedMiseryIndex );

    const response = await request( app ).
      get( `/acts/${actId}?pretty` ).
      expect( 200 );

    // Get raw response text
    const rawText = response.text;

    // Beautified JSON should contain newlines and 2-space indentation
    expect( rawText ).toContain( '\n' );
    expect( rawText ).toMatch( /\{\s*\n/u );
    expect( rawText ).toMatch( /\n {2}"/u );
  } );
} );

describe( 'GET /acts/:id - HTTP headers', () => {
  /**
   * Test robot blocking headers
   */
  test( 'response includes robot blocking headers', async () => {
    const actId = transformedJungleRot.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedJungleRot );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    expect( response.headers[ 'x-robots-tag' ] ).
      toBe( 'noindex, nofollow, noarchive, nosnippet' );
  } );

  /**
   * Test no-cache headers
   */
  test( 'response includes no-cache headers', async () => {
    const actId = transformedJungleRot.musicbrainzId;

    artistService.getArtist.mockResolvedValue( transformedJungleRot );

    const response = await request( app ).
      get( `/acts/${actId}` ).
      expect( 200 );

    expect( response.headers[ 'cache-control' ] ).
      toBe( 'no-store, no-cache, must-revalidate, proxy-revalidate' );
    expect( response.headers.pragma ).toBe( 'no-cache' );
    expect( response.headers.expires ).toBe( '0' );
  } );
} );
