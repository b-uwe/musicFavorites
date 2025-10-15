/**
 * Tests for fixture modifier test utility
 * @module __tests__/testHelpers/fixtureModifier
 */

const fixtureModifier = require( '../../testHelpers/fixtureModifier' );

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

      const result = fixtureModifier.modifyFixture( original, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

      expect( result.name ).toBe( 'Test' );
      expect( result.newField ).toBe( 'newValue' );
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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyFixture( fixture, modifications );

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

      const result = fixtureModifier.modifyArrayItem( originalArray, 0, modifications );

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

      const result = fixtureModifier.modifyArrayItem( originalArray, 2, modifications );

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

      expect( () => fixtureModifier.modifyArrayItem( originalArray, 5, modifications ) ).
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

      expect( () => fixtureModifier.modifyArrayItem( originalArray, -1, modifications ) ).
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

      const result = fixtureModifier.modifyArrayItem( originalArray, 0, modifications );

      expect( result[ 0 ].location.city ).toBe( 'Paris' );
      expect( result[ 0 ].location.country ).toBe( 'UK' );
    } );
  } );
} );
