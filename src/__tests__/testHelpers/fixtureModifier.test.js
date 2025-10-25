/**
 * Tests for fixture modifier test utility
 * @module __tests__/testHelpers/fixtureModifier
 */

require( '../../testHelpers/fixtureModifier' );

describe( 'Fixture Modifier', () => {
  describe( 'modifyFixture', () => {
    /**
     * Test deep cloning to prevent original fixture mutation
     */
    test( 'creates deep copy without mutating original fixture', () => {
      const original = {
        'name': 'Test Event',
        'nested': {
          'value': 42
        }
      };
      const modifications = {
        'name': 'Modified Event'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( original, modifications );

      expect( result.name ).toBe( 'Modified Event' );
      expect( original.name ).toBe( 'Test Event' );
      expect( result ).not.toBe( original );
    } );

    /**
     * Test simple property modification
     */
    test( 'modifies top-level properties', () => {
      const fixture = {
        'name': 'Original',
        'date': '2025-01-01'
      };
      const modifications = {
        'date': '2025-12-31'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'Original' );
      expect( result.date ).toBe( '2025-12-31' );
    } );

    /**
     * Test nested property modification using dot notation
     */
    test( 'modifies nested properties using dot notation', () => {
      const fixture = {
        'location': {
          'address': {
            'city': 'London'
          }
        }
      };
      const modifications = {
        'location.address.city': 'Paris'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.location.address.city ).toBe( 'Paris' );
    } );

    /**
     * Test array element modification using bracket notation
     */
    test( 'modifies array elements using bracket notation', () => {
      const fixture = {
        'events': [
          {
            'name': 'Event 1'
          },
          {
            'name': 'Event 2'
          }
        ]
      };
      const modifications = {
        'events[0].name': 'Modified Event 1'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.events[ 0 ].name ).toBe( 'Modified Event 1' );
      expect( result.events[ 1 ].name ).toBe( 'Event 2' );
    } );

    /**
     * Test deletion of properties
     */
    test( 'deletes properties when value is undefined', () => {
      const fixture = {
        'name': 'Test',
        'optional': 'value'
      };
      const modifications = {
        'optional': undefined
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'Test' );
      expect( result.optional ).toBeUndefined();
      expect( Object.prototype.hasOwnProperty.call( result, 'optional' ) ).toBe( false );
    } );

    /**
     * Test deletion of nested properties
     */
    test( 'deletes nested properties using dot notation', () => {
      const fixture = {
        'location': {
          'address': 'Street',
          'geo': {
            'lat': 51.5,
            'lon': -0.1
          }
        }
      };
      const modifications = {
        'location.geo': undefined
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.location.address ).toBe( 'Street' );
      expect( result.location.geo ).toBeUndefined();
      expect( Object.prototype.hasOwnProperty.call( result.location, 'geo' ) ).toBe( false );
    } );

    /**
     * Test adding new properties
     */
    test( 'adds new properties not in original fixture', () => {
      const fixture = {
        'name': 'Test'
      };
      const modifications = {
        'newField': 'newValue'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'Test' );
      expect( result.newField ).toBe( 'newValue' );
    } );

    /**
     * Test creating nested paths that don't exist
     */
    test( 'creates intermediate path objects when they do not exist', () => {
      const fixture = {
        'name': 'Test'
      };
      const modifications = {
        'location.address.city': 'London'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'Test' );
      expect( result.location ).toBeDefined();
      expect( result.location.address ).toBeDefined();
      expect( result.location.address.city ).toBe( 'London' );
    } );

    /**
     * Test handling of null values
     */
    test( 'sets properties to null when explicitly specified', () => {
      const fixture = {
        'location': {
          'geo': {
            'lat': 51.5,
            'lon': -0.1
          }
        }
      };
      const modifications = {
        'location.geo': null
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.location.geo ).toBeNull();
    } );

    /**
     * Test multiple modifications at once
     */
    test( 'applies multiple modifications simultaneously', () => {
      const fixture = {
        'name': 'Event',
        'date': '2025-01-01',
        'location': {
          'city': 'London',
          'geo': {
            'lat': 51.5
          }
        }
      };
      const modifications = {
        'name': 'New Event',
        'date': '2025-12-31',
        'location.city': 'Paris',
        'location.geo.lat': 48.8
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'New Event' );
      expect( result.date ).toBe( '2025-12-31' );
      expect( result.location.city ).toBe( 'Paris' );
      expect( result.location.geo.lat ).toBe( 48.8 );
    } );

    /**
     * Test empty modifications object
     */
    test( 'returns copy with no changes when modifications is empty', () => {
      const fixture = {
        'name': 'Test'
      };
      const modifications = {};

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result ).toEqual( fixture );
      expect( result ).not.toBe( fixture );
    } );

    /**
     * Test handling of arrays in fixture
     */
    test( 'preserves arrays when not modified', () => {
      const fixture = {
        'items': [ 'a', 'b', 'c' ]
      };
      const modifications = {
        'name': 'Test'
      };

      const result = mf.testing.fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.items ).toEqual( [ 'a', 'b', 'c' ] );
      expect( result.name ).toBe( 'Test' );
    } );
  } );

  describe( 'modifyArrayItem', () => {
    /**
     * Test modifying single array item by index
     */
    test( 'modifies specific array item without mutating original', () => {
      const originalArray = [
        {
          'name': 'Item 1'
        },
        {
          'name': 'Item 2'
        }
      ];
      const modifications = {
        'name': 'Modified Item'
      };

      const result = mf.testing.fixtureModifier.modifyArrayItem( originalArray, 0, modifications );

      expect( result[ 0 ].name ).toBe( 'Modified Item' );
      expect( result[ 1 ].name ).toBe( 'Item 2' );
      expect( originalArray[ 0 ].name ).toBe( 'Item 1' );
    } );

    /**
     * Test modifying last array item
     */
    test( 'modifies last array item', () => {
      const originalArray = [
        {
          'date': '2025-01-01'
        },
        {
          'date': '2025-01-02'
        },
        {
          'date': '2025-01-03'
        }
      ];
      const modifications = {
        'date': '2025-12-31'
      };

      const result = mf.testing.fixtureModifier.modifyArrayItem( originalArray, 2, modifications );

      expect( result[ 2 ].date ).toBe( '2025-12-31' );
      expect( result[ 0 ].date ).toBe( '2025-01-01' );
      expect( result[ 1 ].date ).toBe( '2025-01-02' );
    } );

    /**
     * Test invalid index handling
     */
    test( 'throws error for out of bounds index', () => {
      const originalArray = [
        {
          'name': 'Item'
        }
      ];
      const modifications = {
        'name': 'Modified'
      };

      expect( () => mf.testing.fixtureModifier.modifyArrayItem( originalArray, 5, modifications ) ).
        toThrow( 'Index 5 out of bounds for array of length 1' );
    } );

    /**
     * Test negative index handling
     */
    test( 'throws error for negative index', () => {
      const originalArray = [
        {
          'name': 'Item'
        }
      ];
      const modifications = {
        'name': 'Modified'
      };

      expect( () => mf.testing.fixtureModifier.modifyArrayItem( originalArray, -1, modifications ) ).
        toThrow( 'Index must be non-negative' );
    } );

    /**
     * Test nested modifications in array item
     */
    test( 'applies nested modifications to array item', () => {
      const originalArray = [
        {
          'location': {
            'city': 'London',
            'country': 'UK'
          }
        }
      ];
      const modifications = {
        'location.city': 'Paris'
      };

      const result = mf.testing.fixtureModifier.modifyArrayItem( originalArray, 0, modifications );

      expect( result[ 0 ].location.city ).toBe( 'Paris' );
      expect( result[ 0 ].location.country ).toBe( 'UK' );
    } );
  } );

  describe( 'normalizeDates', () => {
    /**
     * Helper to get UTC date N days in the future
     * @param {number} daysInFuture - Number of days in the future
     * @returns {string} ISO date string in YYYY-MM-DD format
     */
    const getUtcDateInFuture = ( daysInFuture ) => {
      const date = new Date();

      date.setUTCDate( date.getUTCDate() + daysInFuture );
      date.setUTCHours( 0, 0, 0, 0 );

      return date.toISOString().split( 'T' )[ 0 ];
    };

    /**
     * Test basic date normalization with default offset
     */
    test( 'normalizes dates to 7 days in future by default', () => {
      const fixture = {
        'event': {
          'startDate': '2025-11-25T18:00:00'
        }
      };
      const expectedDate = getUtcDateInFuture( 7 );

      const result = mf.testing.fixtureModifier.normalizeDates( fixture );

      expect( result.event.startDate ).toMatch( new RegExp( `^${expectedDate}T18:00:00$`, 'u' ) );
    } );

    /**
     * Test custom days in future
     */
    test( 'normalizes dates to custom days in future', () => {
      const fixture = {
        'event': {
          'startDate': '2025-11-25T18:00:00'
        }
      };
      const expectedDate = getUtcDateInFuture( 30 );

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 30 );

      expect( result.event.startDate ).toMatch( new RegExp( `^${expectedDate}T18:00:00$`, 'u' ) );
    } );

    /**
     * Test preservation of time components
     */
    test( 'preserves time components from original dates', () => {
      const fixture = {
        'event1': {
          'startDate': '2025-11-25T18:00:00'
        },
        'event2': {
          'startDate': '2025-11-28T23:59:59'
        }
      };

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.event1.startDate ).toMatch( /T18:00:00$/u );
      expect( result.event2.startDate ).toMatch( /T23:59:59$/u );
    } );

    /**
     * Test handling of date-only strings
     */
    test( 'normalizes date-only strings without time component', () => {
      const fixture = {
        'date': '2025-11-25'
      };
      const expectedDate = getUtcDateInFuture( 7 );

      const result = mf.testing.fixtureModifier.normalizeDates( fixture );

      expect( result.date ).toBe( expectedDate );
    } );

    /**
     * Test handling of dates with Z suffix
     */
    test( 'preserves Z suffix on dates that have it', () => {
      const fixture = {
        'withZ': '2025-11-25T18:00:00Z',
        'withoutZ': '2025-11-25T18:00:00'
      };

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.withZ ).toMatch( /Z$/u );
      expect( result.withoutZ ).not.toMatch( /Z$/u );
    } );

    /**
     * Test normalization of arrays
     */
    test( 'normalizes dates in arrays', () => {
      const fixture = [
        {
          'startDate': '2025-11-25T18:00:00'
        },
        {
          'startDate': '2025-11-28T17:30:00'
        }
      ];
      const expectedDate = getUtcDateInFuture( 7 );

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result[ 0 ].startDate ).toMatch( new RegExp( `^${expectedDate}T18:00:00$`, 'u' ) );
      expect( result[ 1 ].startDate ).toMatch( new RegExp( `^${expectedDate}T17:30:00$`, 'u' ) );
    } );

    /**
     * Test deep nested date normalization
     */
    test( 'normalizes deeply nested dates', () => {
      const fixture = {
        'events': [
          {
            'info': {
              'dates': {
                'start': '2025-11-25T18:00:00',
                'end': '2025-11-25'
              }
            }
          }
        ]
      };
      const expectedDate = getUtcDateInFuture( 7 );

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.events[ 0 ].info.dates.start ).toMatch( new RegExp( `^${expectedDate}T18:00:00$`, 'u' ) );
      expect( result.events[ 0 ].info.dates.end ).toBe( expectedDate );
    } );

    /**
     * Test that non-date strings are not modified
     */
    test( 'does not modify non-date strings', () => {
      const fixture = {
        'name': 'Test Event',
        'description': '2025-11-25 is not a date in this context',
        'startDate': '2025-11-25T18:00:00'
      };

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.name ).toBe( 'Test Event' );
      expect( result.description ).toBe( '2025-11-25 is not a date in this context' );
    } );

    /**
     * Test that original fixture is not mutated
     */
    test( 'does not mutate original fixture', () => {
      const fixture = {
        'startDate': '2025-11-25T18:00:00'
      };
      const originalDate = fixture.startDate;

      mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( fixture.startDate ).toBe( originalDate );
    } );

    /**
     * Test handling of null and undefined values
     */
    test( 'handles null and undefined values', () => {
      const fixture = {
        'nullValue': null,
        'undefinedValue': undefined,
        'startDate': '2025-11-25T18:00:00'
      };

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.nullValue ).toBeNull();
      expect( result.undefinedValue ).toBeUndefined();
      expect( result.startDate ).toMatch( /T18:00:00$/u );
    } );

    /**
     * Test handling of non-ISO date formats
     */
    test( 'ignores non-ISO date formats', () => {
      const fixture = {
        'invalidDate1': '11/25/2025',
        'invalidDate2': '25-11-2025',
        'validDate': '2025-11-25T18:00:00'
      };

      const result = mf.testing.fixtureModifier.normalizeDates( fixture, 7 );

      expect( result.invalidDate1 ).toBe( '11/25/2025' );
      expect( result.invalidDate2 ).toBe( '25-11-2025' );
      expect( result.validDate ).toMatch( /T18:00:00$/u );
    } );

    /**
     * Test handling of empty fixtures
     */
    test( 'handles empty objects and arrays', () => {
      expect( mf.testing.fixtureModifier.normalizeDates( {}, 7 ) ).toEqual( {} );
      expect( mf.testing.fixtureModifier.normalizeDates( [], 7 ) ).toEqual( [] );
    } );
  } );
} );
