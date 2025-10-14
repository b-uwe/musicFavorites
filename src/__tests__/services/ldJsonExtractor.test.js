/**
 * Tests for LD+JSON extractor service
 */

const ldJsonExtractor = require( '../../services/ldJsonExtractor' );

describe( 'LD+JSON Extractor', () => {
  describe( 'extractLdJson', () => {
    test( 'extracts single LD+JSON block from HTML', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@context": "https://schema.org", "@type": "Person", "name": "John Doe"}
            </script>
          </head>
        </html>
      `;

      const result = ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          'name': 'John Doe'
        }
      ] );
    } );

    test( 'extracts multiple LD+JSON blocks from HTML', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Person", "name": "John"}
            </script>
            <script type="application/ld+json">
              {"@type": "Organization", "name": "Acme"}
            </script>
          </head>
        </html>
      `;

      const result = ldJsonExtractor.extractLdJson( html );

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
      const html = `
        <html>
          <head>
            <script type="text/javascript">
              console.log('not ld+json');
            </script>
          </head>
        </html>
      `;

      const result = ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'skips malformed JSON and continues with valid blocks', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Person", "name": "Valid"}
            </script>
            <script type="application/ld+json">
              {invalid json here}
            </script>
            <script type="application/ld+json">
              {"@type": "Organization", "name": "Also Valid"}
            </script>
          </head>
        </html>
      `;

      const result = ldJsonExtractor.extractLdJson( html );

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
      const html = '<html><body>Just text</body></html>';

      const result = ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );

    test( 'handles empty HTML string', () => {
      const html = '';

      const result = ldJsonExtractor.extractLdJson( html );

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'fetchAndExtractLdJson', () => {
    test( 'fetches URL and extracts LD+JSON', async () => {
      const url = 'https://www.bandsintown.com/a/6461184';

      const result = await ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( Array.isArray( result ) ).toBe( true );
      // Should have at least some data from bandsintown
      expect( result.length ).toBeGreaterThan( 0 );
    } );

    test( 'returns empty array for unreachable URL', async () => {
      const url = 'https://invalid-domain-that-does-not-exist-12345.com';

      const result = await ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );

    test( 'returns empty array for invalid URL', async () => {
      const url = 'not-a-valid-url';

      const result = await ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );

    test( 'returns empty array for 404 response', async () => {
      const url = 'https://www.bandsintown.com/nonexistent-page-12345';

      const result = await ldJsonExtractor.fetchAndExtractLdJson( url );

      expect( result ).toEqual( [] );
    } );
  } );
} );
