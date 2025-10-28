/**
 * Unit tests for Bandsintown URL validation in actService
 * @module __tests__/unit/services/actService.urlValidation
 */

// Mock external I/O
jest.mock( 'axios' );
jest.mock( 'mongodb' );

describe( 'actService - Bandsintown URL Validation', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useFakeTimers();

    // Load modules
    require( '../../../services/database' );
    require( '../../../services/musicbrainz' );
    require( '../../../services/ldJsonExtractor' );
    require( '../../../services/bandsintownTransformer' );
    require( '../../../services/musicbrainzTransformer' );
    require( '../../../services/fetchQueue' );
    require( '../../../services/actService' );

    // Spy on dependencies
    jest.spyOn( mf.ldJsonExtractor, 'fetchAndExtractLdJson' ).mockResolvedValue( [] );
  } );

  afterEach( () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  } );

  describe( 'fetchBandsintownEvents URL validation', () => {
    test( 'accepts valid HTTPS Bandsintown URL with numeric ID', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( [] );
      await mf.actService.fetchBandsintownEvents( artistData );

      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://bandsintown.com/a/12345' );
    } );

    test( 'accepts valid HTTP Bandsintown URL', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'http://bandsintown.com/a/67890'
        }
      };

      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( [] );
      await mf.actService.fetchBandsintownEvents( artistData );

      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'http://bandsintown.com/a/67890' );
    } );

    test( 'accepts valid Bandsintown URL with www subdomain', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://www.bandsintown.com/a/99999'
        }
      };

      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( [] );
      await mf.actService.fetchBandsintownEvents( artistData );

      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/99999' );
    } );

    test( 'rejects Bandsintown URL with non-numeric ID', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/artist-name'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );

    test( 'rejects Bandsintown URL with query parameters', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345?param=value'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );

    test( 'rejects Bandsintown URL with wrong path', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://bandsintown.com/artist/12345'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );

    test( 'rejects non-Bandsintown domain', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'https://songkick.com/a/12345'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );

    test( 'rejects invalid protocol', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'ftp://bandsintown.com/a/12345'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );

    test( 'rejects malformed URL', async () => {
      const artistData = {
        'relations': {
          'bandsintown': 'not-a-url'
        }
      };

      const result = await mf.actService.fetchBandsintownEvents( artistData );

      expect( result ).toEqual( [] );
      expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
    } );
  } );
} );
