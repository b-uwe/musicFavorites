/**
 * Tests for Bandsintown event transformer
 * @module __tests__/services/bandsintownTransformer
 */

const bandsintownTransformer = require( '../../services/bandsintownTransformer' );
const fixtureVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

describe( 'Bandsintown Transformer', () => {
  describe( 'transformEvents', () => {
    /**
     * Test transformation of valid MusicEvent objects to our event schema
     */
    test( 'transforms Bandsintown LD+JSON MusicEvent to event schema', () => {
      const result = bandsintownTransformer.transformEvents( fixtureVulvodynia );

      expect( result ).toBeInstanceOf( Array );
      expect( result.length ).toBeGreaterThan( 0 );

      // Check first event structure
      const firstEvent = result[ 0 ];

      expect( firstEvent ).toHaveProperty( 'name' );
      expect( firstEvent ).toHaveProperty( 'date' );
      expect( firstEvent ).toHaveProperty( 'localTime' );
      expect( firstEvent ).toHaveProperty( 'location' );
      expect( firstEvent.name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( firstEvent.date ).toBe( '2025-11-25' );
      expect( firstEvent.localTime ).toBe( '18:00:00' );
    } );

    /**
     * Test location structure transformation
     */
    test( 'transforms location with address and geo coordinates', () => {
      const result = bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const firstEvent = result[ 0 ];

      expect( firstEvent.location ).toHaveProperty( 'address' );
      expect( firstEvent.location ).toHaveProperty( 'geo' );
      expect( firstEvent.location.address ).toBe( 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom' );
      expect( firstEvent.location.geo ).toEqual( {
        'lat': 51.5343501,
        'lon': -0.1058837
      } );
    } );

    /**
     * Test filtering of non-MusicEvent objects
     */
    test( 'filters out non-MusicEvent objects', () => {
      const mixedData = [
        ...fixtureVulvodynia,
        {
          '@type': 'Organization',
          'name': 'Not an event'
        },
        {
          '@type': 'Person',
          'name': 'Not an event either'
        }
      ];

      const result = bandsintownTransformer.transformEvents( mixedData );

      // Should only include MusicEvent objects (fixture has 4 MusicEvents out of 25 total items)
      expect( result.length ).toBe( 4 );
    } );

    /**
     * Test handling of empty arrays
     */
    test( 'returns empty array for empty input', () => {
      const result = bandsintownTransformer.transformEvents( [] );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of null/undefined input
     */
    test( 'returns empty array for null input', () => {
      const result = bandsintownTransformer.transformEvents( null );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of undefined input
     */
    test( 'returns empty array for undefined input', () => {
      const result = bandsintownTransformer.transformEvents();

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of events with missing geo coordinates
     */
    test( 'handles events with missing geo coordinates', () => {
      const eventWithoutGeo = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': '2025-12-01T19:00:00',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': '123 Main St',
            'postalCode': '12345',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutGeo );

      expect( result[ 0 ].location.geo ).toBeNull();
    } );

    /**
     * Test date and time extraction from startDate
     */
    test( 'correctly extracts date and localTime from startDate', () => {
      const testEvent = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': '2025-11-28T17:30:00',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': '123 Main St',
            'postalCode': '12345',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( testEvent );

      expect( result[ 0 ].date ).toBe( '2025-11-28' );
      expect( result[ 0 ].localTime ).toBe( '17:30:00' );
    } );

    /**
     * Test handling of events with missing location
     */
    test( 'handles events with missing location gracefully', () => {
      const eventWithoutLocation = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': '2025-12-01T19:00:00'
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutLocation );

      expect( result[ 0 ].location ).toEqual( {
        'address': null,
        'geo': null
      } );
    } );

    /**
     * Test address concatenation
     */
    test( 'concatenates address fields correctly', () => {
      const result = bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const secondEvent = result[ 1 ];

      expect( secondEvent.location.address ).toBe(
        'Leeds University Union,, Lifton Pl, LS2 9JT, Leeds, United Kingdom'
      );
    } );

    /**
     * Test handling of events with partial address
     */
    test( 'handles events with partial address', () => {
      const eventWithPartialAddress = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': '2025-12-01T19:00:00',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithPartialAddress );

      expect( result[ 0 ].location.address ).toBe( 'Test City, Test Country' );
    } );

    /**
     * Test handling of missing startDate
     */
    test( 'handles missing startDate gracefully', () => {
      const eventWithoutStartDate = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutStartDate );

      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
    } );

    /**
     * Test handling of malformed startDate with missing time
     */
    test( 'handles startDate with missing time component', () => {
      const eventWithDateOnly = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': '2025-12-01',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithDateOnly );

      expect( result[ 0 ].date ).toBe( '2025-12-01' );
      expect( result[ 0 ].localTime ).toBe( '' );
    } );

    /**
     * Test handling of invalid startDate format
     */
    test( 'handles invalid startDate format', () => {
      const eventWithInvalidDate = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': 'not-a-date',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithInvalidDate );

      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
    } );

    /**
     * Test handling of non-string startDate
     */
    test( 'handles non-string startDate', () => {
      const eventWithNumberDate = [ {
        '@type': 'MusicEvent',
        'name': 'Test Event',
        'startDate': 12345,
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Test City',
            'addressCountry': 'Test Country'
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithNumberDate );

      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
    } );
  } );
} );
