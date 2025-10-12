/**
 * Tests for the Music Favorites API
 */

const request = require( 'supertest' );
const app = require( '../app' );

describe( 'GET /act/:id - Basic functionality', () => {
  /**
   * Test basic act endpoint response
   */
  test( 'returns act data with valid MusicBrainz UUID', async () => {
    const actId = '53689c08-f234-4c47-9256-58c8568f06d1';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    expect( response.body.type ).toBe( 'act' );
    expect( response.body.id ).toBe( actId );
    expect( response.body.meta ).toBeDefined();
    expect( response.body.meta.attribution.sources ).toContain( 'MusicBrainz' );
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );

  /**
   * Test with different UUID
   */
  test( 'returns act data with different MusicBrainz UUID', async () => {
    const actId = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 );

    expect( response.body.type ).toBe( 'act' );
    expect( response.body.id ).toBe( actId );
  } );

  /**
   * Test invalid route handling
   */
  test( 'returns 404 for invalid route', async () => {
    const actId = '53689c08-f234-4c47-9256-58c8568f06d1';
    await request( app ).
      get( `/invalid/${actId}` ).
      expect( 404 );
  } );
} );

describe( 'GET /act/:id - Response metadata', () => {
  /**
   * Test attribution information
   */
  test( 'response includes attribution information', async () => {
    const actId = 'cc197bad-dc9c-440d-a5b5-d52ba2e14234';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 );

    expect( response.body.meta.attribution ).toHaveProperty( 'sources' );
    expect( response.body.meta.attribution ).toHaveProperty( 'notice' );
    expect( response.body.meta.attribution.sources ).
      toEqual( expect.arrayContaining( [ 'MusicBrainz', 'Bandsintown', 'Songkick' ] ) );
  } );

  /**
   * Test metadata fields
   */
  test( 'response includes metadata', async () => {
    const actId = '8bfac288-ccc5-448d-9573-c33ea2aa5c30';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 );

    expect( response.body.meta ).toHaveProperty( 'license' );
    expect( response.body.meta ).toHaveProperty( 'repository' );
    expect( response.body.meta.license ).toBe( 'AGPL-3.0' );
  } );
} );

describe( 'GET /act/:id - HTTP headers', () => {
  /**
   * Test robot blocking headers
   */
  test( 'response includes robot blocking headers', async () => {
    const actId = '53689c08-f234-4c47-9256-58c8568f06d1';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 );

    expect( response.headers[ 'x-robots-tag' ] ).
      toBe( 'noindex, nofollow, noarchive, nosnippet' );
  } );

  /**
   * Test no-cache headers
   */
  test( 'response includes no-cache headers', async () => {
    const actId = '53689c08-f234-4c47-9256-58c8568f06d1';
    const response = await request( app ).
      get( `/act/${actId}` ).
      expect( 200 );

    expect( response.headers[ 'cache-control' ] ).
      toBe( 'no-store, no-cache, must-revalidate, proxy-revalidate' );
    expect( response.headers.pragma ).toBe( 'no-cache' );
    expect( response.headers.expires ).toBe( '0' );
  } );
} );
