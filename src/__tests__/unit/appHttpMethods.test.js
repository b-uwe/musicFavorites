/**
 * Unit tests for app.js HTTP method support
 * Tests that unsupported HTTP methods return 404
 * @module __tests__/unit/appHttpMethods
 */

const request = require( 'supertest' );
require( '../../app' );

describe( 'Express App - HTTP Method Support Tests', () => {
  describe( 'Unsupported methods on /acts routes', () => {
    /**
     * Test that POST to GET-only route returns 404
     */
    test( 'returns 404 when POSTing to GET /acts/:id route', async () => {
      const response = await request( mf.app ).
        post( '/acts/test-id' ).
        send( 'test-id' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that GET to POST-only route returns 404
     */
    test( 'returns 404 when GETting POST /acts route', async () => {
      const response = await request( mf.app ).
        get( '/acts' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that PUT is not supported on GET /acts/:id
     */
    test( 'returns 404 for PUT on GET /acts/:id route', async () => {
      const response = await request( mf.app ).
        put( '/acts/test-id' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that PUT is not supported on POST /acts
     */
    test( 'returns 404 for PUT on POST /acts route', async () => {
      const response = await request( mf.app ).
        put( '/acts' ).
        set( 'Content-Type', 'text/plain' ).
        send( 'test-id' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that DELETE is not supported on GET /acts/:id
     */
    test( 'returns 404 for DELETE on GET /acts/:id route', async () => {
      const response = await request( mf.app ).
        delete( '/acts/test-id' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that DELETE is not supported on POST /acts
     */
    test( 'returns 404 for DELETE on POST /acts route', async () => {
      const response = await request( mf.app ).
        delete( '/acts' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );

    /**
     * Test that PATCH is not supported
     */
    test( 'returns 404 for PATCH on /acts routes', async () => {
      const response = await request( mf.app ).
        patch( '/acts/test-id' ).
        expect( 404 );

      expect( response.body.error ).toBe( 'Not found' );
      expect( response.body.status ).toBe( 404 );
    } );
  } );
} );
