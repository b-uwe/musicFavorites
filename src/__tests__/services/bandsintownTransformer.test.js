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
      // Use real O2 Academy Islington event but remove geo coordinates
      const eventWithoutGeo = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ O2 Academy Islington',
        'startDate': '2025-11-25T18:00:00',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'N1 Centre 16 Parkfield St',
            'postalCode': 'N1 0PS',
            'addressLocality': 'London',
            'addressCountry': 'United Kingdom'
          }
          // geo field intentionally removed
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutGeo );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( result[ 0 ].location.geo ).toBeNull();
      expect( result[ 0 ].location.address ).toBe( 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom' );
    } );

    /**
     * Test date and time extraction from startDate using real fixture data
     */
    test( 'correctly extracts date and localTime from startDate', () => {
      const result = bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const secondEvent = result[ 1 ];

      // Second event: Leeds University Stylus @ 2025-11-28T17:30:00
      expect( secondEvent.name ).toBe( 'Vulvodynia @ Leeds University Stylus' );
      expect( secondEvent.date ).toBe( '2025-11-28' );
      expect( secondEvent.localTime ).toBe( '17:30:00' );
    } );

    /**
     * Test handling of events with missing location
     */
    test( 'handles events with missing location gracefully', () => {
      // Use real Rock Café event but remove location entirely
      const eventWithoutLocation = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ Rock Café',
        'startDate': '2025-12-07T19:00:00'
        // location field intentionally removed
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutLocation );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Rock Café' );
      expect( result[ 0 ].date ).toBe( '2025-12-07' );
      expect( result[ 0 ].localTime ).toBe( '19:00:00' );
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
      // Use real Legend Club event but remove street address and postal code
      const eventWithPartialAddress = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ Legend Club',
        'startDate': '2025-12-03T20:00:00',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'addressLocality': 'Milano',
            'addressCountry': 'Italy'
            // streetAddress and postalCode intentionally removed
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 45.516177,
            'longitude': 9.1795117
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithPartialAddress );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Legend Club' );
      expect( result[ 0 ].location.address ).toBe( 'Milano, Italy' );
      expect( result[ 0 ].location.geo ).toEqual( {
        'lat': 45.516177,
        'lon': 9.1795117
      } );
    } );

    /**
     * Test handling of missing startDate
     */
    test( 'handles missing startDate gracefully', () => {
      // Use real O2 Academy Islington event but remove startDate
      const eventWithoutStartDate = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ O2 Academy Islington',
        // startDate intentionally removed
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'N1 Centre 16 Parkfield St',
            'postalCode': 'N1 0PS',
            'addressLocality': 'London',
            'addressCountry': 'United Kingdom'
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 51.5343501,
            'longitude': -0.1058837
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithoutStartDate );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
      expect( result[ 0 ].location.address ).toBe( 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom' );
    } );

    /**
     * Test handling of malformed startDate with missing time
     */
    test( 'handles startDate with missing time component', () => {
      // Use real Rock Café event but modify startDate to date-only format
      const eventWithDateOnly = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ Rock Café',
        'startDate': '2025-12-07', // Time component removed
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'Národní 20',
            'postalCode': '11000',
            'addressLocality': 'Praha 1',
            'addressCountry': 'Czech Republic'
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 50.08201099999999,
            'longitude': 14.418418
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithDateOnly );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Rock Café' );
      expect( result[ 0 ].date ).toBe( '2025-12-07' );
      expect( result[ 0 ].localTime ).toBe( '' );
      expect( result[ 0 ].location.address ).toBe( 'Národní 20, 11000, Praha 1, Czech Republic' );
    } );

    /**
     * Test handling of invalid startDate format
     */
    test( 'handles invalid startDate format', () => {
      // Use real Leeds University event but corrupt the startDate
      const eventWithInvalidDate = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ Leeds University Stylus',
        'startDate': 'invalid-date-format',
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'Leeds University Union,, Lifton Pl',
            'postalCode': 'LS2 9JT',
            'addressLocality': 'Leeds',
            'addressCountry': 'United Kingdom'
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 53.79648,
            'longitude': -1.54785
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithInvalidDate );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Leeds University Stylus' );
      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
      expect( result[ 0 ].location.address ).toBe( 'Leeds University Union,, Lifton Pl, LS2 9JT, Leeds, United Kingdom' );
    } );

    /**
     * Test handling of non-string startDate
     */
    test( 'handles non-string startDate', () => {
      // Use real Legend Club event but set startDate as number instead of string
      const eventWithNumberDate = [ {
        '@type': 'MusicEvent',
        'name': 'Vulvodynia @ Legend Club',
        'startDate': 1733259600000, // Unix timestamp instead of ISO string
        'location': {
          '@type': 'Place',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'Viale Enrico Fermi',
            'postalCode': '20161',
            'addressLocality': 'Milano',
            'addressCountry': 'Italy'
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 45.516177,
            'longitude': 9.1795117
          }
        }
      } ];

      const result = bandsintownTransformer.transformEvents( eventWithNumberDate );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Legend Club' );
      expect( result[ 0 ].date ).toBe( '' );
      expect( result[ 0 ].localTime ).toBe( '' );
      expect( result[ 0 ].location.address ).toBe( 'Viale Enrico Fermi, 20161, Milano, Italy' );
    } );
  } );
} );
