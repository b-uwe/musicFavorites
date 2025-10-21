/**
 * Tests for the Music Favorites API
 */

const request = require( 'supertest' );
const app = require( '../app' );
const artistService = require( '../services/artistService' );
const musicbrainzTransformer = require( '../services/musicbrainzTransformer' );
const fixtureJungleRot = require( './fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( './fixtures/musicbrainz-the-kinks.json' );

jest.mock( '../services/artistService' );

// Transform fixtures to output format
const transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
const transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );

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

describe( 'GET /acts/:id - Basic tests', () => {
  test( 'returns single act when given one ID', async () => {
    const actId = transformedJungleRot.musicbrainzId;

    artistService.fetchMultipleActs.mockResolvedValue( {
      'acts': [ transformedJungleRot ]
    } );

    const response = await request( app ).get( `/acts/${actId}` ).expect( 200 );

    expect( response.body.type ).toBe( 'acts' );
    expect( response.body.acts ).toHaveLength( 1 );
  } );

  test( 'returns multiple acts when given comma-separated IDs', async () => {
    const actIds = `${transformedJungleRot.musicbrainzId},${transformedTheKinks.musicbrainzId}`;

    artistService.fetchMultipleActs.mockResolvedValue( {
      'acts': [ transformedJungleRot, transformedTheKinks ]
    } );

    const response = await request( app ).get( `/acts/${actIds}` ).expect( 200 );

    expect( response.body.acts ).toHaveLength( 2 );
  } );

  test( 'returns 503 error when 2+ acts not cached', async () => {
    const actIds = `${transformedJungleRot.musicbrainzId},${transformedTheKinks.musicbrainzId}`;

    artistService.fetchMultipleActs.mockResolvedValue( {
      'error': {
        'message': '2 acts not cached. Background fetch initiated.',
        'missingCount': 2,
        'cachedCount': 0
      }
    } );

    const response = await request( app ).get( `/acts/${actIds}` ).expect( 503 );

    expect( response.body.error ).toBeDefined();
  } );
} );

describe( 'GET /acts/:id - Edge cases', () => {
  test( 'handles IDs with whitespace correctly', async () => {
    const id1 = transformedJungleRot._id;
    const id2 = transformedTheKinks._id;

    artistService.fetchMultipleActs.mockResolvedValue( {
      'acts': [ transformedJungleRot, transformedTheKinks ]
    } );

    await request( app ).get( `/acts/${id1}, ${id2} ` ).expect( 200 );

    expect( artistService.fetchMultipleActs ).toHaveBeenCalledWith( [ id1, id2 ] );
  } );

  test( 'supports ?pretty query parameter', async () => {
    artistService.fetchMultipleActs.mockResolvedValue( {
      'acts': [ transformedJungleRot ]
    } );

    const response = await request( app ).get( `/acts/${transformedJungleRot.musicbrainzId}?pretty` ).expect( 200 );

    expect( JSON.stringify( response.body, null, 2 ) ).toContain( '\n' );
  } );

  test( 'returns 500 error when fetchMultipleActs throws', async () => {
    artistService.fetchMultipleActs.mockRejectedValue( new Error( 'Unexpected error' ) );

    const response = await request( app ).get( `/acts/${transformedJungleRot.musicbrainzId}` ).expect( 500 );

    expect( response.body.error.message ).toBe( 'Failed to fetch artist data' );
  } );
} );
