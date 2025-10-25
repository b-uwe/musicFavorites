/**
 * Tests for LD+JSON extractor service
 */

const fs = require( 'fs' );
const path = require( 'path' );
require( '../../../services/ldJsonExtractor' );

/**
 * Loads a fixture file
 * @param {string} filename - The fixture filename
 * @returns {string} File contents
 */
const loadFixture = ( filename ) => {
  const fixturePath = path.join( __dirname, '../../fixtures/ldjson', filename );

  return fs.readFileSync( fixturePath, 'utf8' );
};

describe( 'LD+JSON Extractor', () => {
  describe( 'extractLdJson', () => {
    test( 'extracts single LD+JSON block from HTML', () => {
      const html = loadFixture( 'single-block.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          'name': 'John Doe'
        }
      ] );
    } );

    test( 'extracts multiple LD+JSON blocks from HTML', () => {
      const html = loadFixture( 'multiple-blocks.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ] ).toEqual( {
        '@type': 'Person',
        'name': 'John'
      } );
      expect( result[ 1 ] ).toEqual( {
        '@type': 'Organization',
        'name': 'Acme'
      } );
    } );

    test( 'returns empty array when no LD+JSON found', () => {
      const html = loadFixture( 'google-no-ldjson.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'skips malformed JSON and continues with valid blocks', () => {
      const html = loadFixture( 'malformed-json.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ] ).toEqual( {
        '@type': 'Person',
        'name': 'Valid'
      } );
      expect( result[ 1 ] ).toEqual( {
        '@type': 'Organization',
        'name': 'Also Valid'
      } );
    } );

    test( 'handles HTML with no script tags', () => {
      const html = loadFixture( 'no-script-tags.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'handles empty HTML string', () => {
      const html = loadFixture( 'empty.html' );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'handles script tags with empty content', () => {
      const html = '<html><head><script type="application/ld+json"></script></head></html>';

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'extracts from real Bandsintown HTML', () => {
      const html = loadFixture( 'bandsintown-vulvodynia.html' );
      const expected = JSON.parse( loadFixture( 'bandsintown-vulvodynia.json' ) );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( expected );
      expect( result ).toHaveLength( 25 );
    } );

    test( 'extracts from real Festivals United HTML', () => {
      const html = loadFixture( 'festivalsunited-alcatraz.html' );
      const expected = JSON.parse( loadFixture( 'festivalsunited-alcatraz.json' ) );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( expected );
      expect( result ).toHaveLength( 1 );
      expect( result[ 0 ][ '@type' ] ).toBe( 'Festival' );
    } );

    test( 'extracts from real Songkick HTML', () => {
      const html = loadFixture( 'songkick-anaal-nathrakh.html' );
      const expected = JSON.parse( loadFixture( 'songkick-anaal-nathrakh.json' ) );

      const result = mf.testing.ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( expected );
      expect( result ).toHaveLength( 6 );
    } );
  } );

  describe( 'fetchAndExtractLdJson', () => {
    test( 'returns empty array for unreachable URL', async () => {
      const url = 'https://invalid-domain-that-does-not-exist-12345.com';

      const result = await mf.ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );

    test( 'returns empty array for invalid URL', async () => {
      const url = 'not-a-valid-url';

      const result = await mf.ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );

    test( 'returns empty array for 404 response', async () => {
      const url = 'https://www.bandsintown.com/nonexistent-page-12345';

      const result = await mf.ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );
  } );
} );
