/**
 * Tests for Bandsintown event transformer
 * @module __tests__/services/bandsintownTransformer
 */

require( '../../../services/bandsintownTransformer' );
require( '../../../testHelpers/fixtureHelpers' );
const fixtureVulvodyniaRaw = require( '../../fixtures/ldjson/bandsintown-vulvodynia.json' );

// Normalize fixture dates to be 30 days in the future to prevent test expiration
const fixtureVulvodynia = mf.testing.fixtureHelpers.normalizeDates( fixtureVulvodyniaRaw, 30 );

describe( 'Bandsintown Transformer', () => {
  describe( 'extractDate', () => {
    /**
     * Test extractDate with null input
     */
    test( 'returns empty string for null input', () => {
      const result = mf.testing.bandsintownTransformer.extractDate( null );

      expect( result ).toBe( '' );
    } );

    /**
     * Test extractDate with non-string input (truthy value)
     */
    test( 'returns empty string for non-string truthy input', () => {
      const result = mf.testing.bandsintownTransformer.extractDate( { 'date': '2025-01-01' } );

      expect( result ).toBe( '' );
    } );

    /**
     * Test extractDate with valid ISO date string
     */
    test( 'extracts date from valid ISO datetime string', () => {
      const result = mf.testing.bandsintownTransformer.extractDate( '2025-11-25T18:00:00' );

      expect( result ).toBe( '2025-11-25' );
    } );

    /**
     * Test extractDate with string that doesn't match date pattern
     */
    test( 'returns empty string for invalid date format', () => {
      const result = mf.testing.bandsintownTransformer.extractDate( 'not-a-date' );

      expect( result ).toBe( '' );
    } );
  } );

  describe( 'extractLocalTime', () => {
    /**
     * Test extractLocalTime with null input
     */
    test( 'returns empty string for null input', () => {
      const result = mf.testing.bandsintownTransformer.extractLocalTime( null );

      expect( result ).toBe( '' );
    } );

    /**
     * Test extractLocalTime with non-string input (truthy value)
     */
    test( 'returns empty string for non-string truthy input', () => {
      const result = mf.testing.bandsintownTransformer.extractLocalTime( { 'time': '18:00:00' } );

      expect( result ).toBe( '' );
    } );

    /**
     * Test extractLocalTime with valid ISO datetime string
     */
    test( 'extracts time from valid ISO datetime string', () => {
      const result = mf.testing.bandsintownTransformer.extractLocalTime( '2025-11-25T18:00:00' );

      expect( result ).toBe( '18:00:00' );
    } );
  } );

  describe( 'transformEvents', () => {
    /**
     * Test transformation of valid MusicEvent objects to our event schema
     */
    test( 'transforms Bandsintown LD+JSON MusicEvent to event schema', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia );

      expect( result ).toBeInstanceOf( Array );
      expect( result.length ).toBeGreaterThan( 0 );

      // Check first event structure
      const [ firstEvent ] = result;

      expect( firstEvent ).toHaveProperty( 'name' );
      expect( firstEvent ).toHaveProperty( 'date' );
      expect( firstEvent ).toHaveProperty( 'localTime' );
      expect( firstEvent ).toHaveProperty( 'location' );
      expect( firstEvent.name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( firstEvent.date ).toMatch( /^\d{4}-\d{2}-\d{2}$/u );
      expect( firstEvent.localTime ).toBe( '18:00:00' );
    } );

    /**
     * Test location structure transformation
     */
    test( 'transforms location with address and geo coordinates', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const [ firstEvent ] = result;

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

      const result = mf.bandsintownTransformer.transformEvents( mixedData );

      // Should only include MusicEvent objects (fixture has 4 MusicEvents out of 25 total items)
      expect( result.length ).toBe( 4 );
    } );

    /**
     * Test handling of empty arrays
     */
    test( 'returns empty array for empty input', () => {
      const result = mf.bandsintownTransformer.transformEvents( [] );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of null/undefined input
     */
    test( 'returns empty array for null input', () => {
      const result = mf.bandsintownTransformer.transformEvents( null );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of undefined input
     */
    test( 'returns empty array for undefined input', () => {
      const result = mf.bandsintownTransformer.transformEvents();

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of events with missing geo coordinates
     */
    test( 'handles events with missing geo coordinates', () => {
      // Use real O2 Academy Islington event but remove geo coordinates
      const eventWithoutGeo = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'location.geo': undefined
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithoutGeo );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( result[ 0 ].location.geo ).toBeNull();
      expect( result[ 0 ].location.address ).toBe( 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom' );
    } );

    /**
     * Test handling of events with invalid geo coordinate types
     */
    test( 'handles events with non-number geo coordinates', () => {
      const eventWithInvalidGeo = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'location.geo.latitude': '51.5343501',
          'location.geo.longitude': '-0.1058837'
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithInvalidGeo );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ O2 Academy Islington' );
      expect( result[ 0 ].location.geo ).toBeNull();
      expect( result[ 0 ].location.address ).toBe( 'N1 Centre 16 Parkfield St, N1 0PS, London, United Kingdom' );
    } );

    /**
     * Test date and time extraction from startDate using real fixture data
     */
    test( 'correctly extracts date and localTime from startDate', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const [ , secondEvent ] = result;

      // Second event: Leeds University Stylus with time 17:30:00
      expect( secondEvent.name ).toBe( 'Vulvodynia @ Leeds University Stylus' );
      expect( secondEvent.date ).toMatch( /^\d{4}-\d{2}-\d{2}$/u );
      expect( secondEvent.localTime ).toBe( '17:30:00' );
    } );

    /**
     * Test handling of events with missing location
     */
    test( 'handles events with missing location gracefully', () => {
      // Use real Rock Café event but remove location entirely
      const eventWithoutLocation = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 3, {
          'location': undefined
        } )[ 3 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithoutLocation );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Rock Café' );
      expect( result[ 0 ].date ).toMatch( /^\d{4}-\d{2}-\d{2}$/u );
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
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia );
      const [ , secondEvent ] = result;

      expect( secondEvent.location.address ).toBe( 'Leeds University Union,, Lifton Pl, LS2 9JT, Leeds, United Kingdom' );
    } );

    /**
     * Test handling of events with partial address
     */
    test( 'handles events with partial address', () => {
      // Use real Legend Club event but remove street address and postal code
      const eventWithPartialAddress = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 2, {
          'location.address.streetAddress': undefined,
          'location.address.postalCode': undefined
        } )[ 2 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithPartialAddress );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Legend Club' );
      expect( result[ 0 ].date ).toMatch( /^\d{4}-\d{2}-\d{2}$/u );
      expect( result[ 0 ].location.address ).toBe( 'Milano, Italy' );
      expect( result[ 0 ].location.geo ).toEqual( {
        'lat': 45.516177,
        'lon': 9.1795117
      } );
    } );

    /**
     * Test handling of events with empty address (all fields null/undefined)
     */
    test( 'handles events with completely empty address object', () => {
      const eventWithEmptyAddress = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 2, {
          'name': 'Vulvodynia @ Unknown Venue',
          'location.address.streetAddress': null,
          'location.address.postalCode': null,
          'location.address.addressLocality': null,
          'location.address.addressCountry': null
        } )[ 2 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithEmptyAddress );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Unknown Venue' );
      expect( result[ 0 ].location.address ).toBeNull();
      expect( result[ 0 ].location.geo ).toEqual( {
        'lat': 45.516177,
        'lon': 9.1795117
      } );
    } );

    /**
     * Test handling of missing startDate
     */
    test( 'filters out events with missing startDate', () => {
      const eventWithoutStartDate = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'startDate': undefined
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithoutStartDate );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of malformed startDate with missing time
     */
    test( 'handles startDate with missing time component', () => {
      // Calculate a future date (30 days from now)
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 30 );
      const [ futureDateStr ] = futureDate.toISOString().split( 'T' );

      const eventWithDateOnly = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 3, {
          'startDate': futureDateStr
        } )[ 3 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithDateOnly );

      expect( result[ 0 ].name ).toBe( 'Vulvodynia @ Rock Café' );
      expect( result[ 0 ].date ).toBe( futureDateStr );
      expect( result[ 0 ].localTime ).toBe( '' );
      expect( result[ 0 ].location.address ).toBe( 'Národní 20, 11000, Praha 1, Czech Republic' );
    } );

    /**
     * Test handling of invalid startDate format
     */
    test( 'filters out events with invalid startDate format', () => {
      const eventWithInvalidDate = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 1, {
          'startDate': 'invalid-date-format'
        } )[ 1 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithInvalidDate );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of non-string startDate
     */
    test( 'filters out events with non-string startDate', () => {
      const eventWithNumberDate = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 2, {
          'startDate': 1733259600000
        } )[ 2 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithNumberDate );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of null startDate
     */
    test( 'filters out events with null startDate', () => {
      const eventWithNullDate = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'startDate': null
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithNullDate );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of boolean startDate (truthy but not string)
     */
    test( 'filters out events with boolean startDate', () => {
      const eventWithBooleanDate = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'startDate': true
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithBooleanDate );

      expect( result ).toEqual( [] );
    } );

    /**
     * Test handling of null event name
     */
    test( 'handles events with null name gracefully', () => {
      const eventWithNullName = [
        mf.testing.fixtureHelpers.modifyArrayItem( fixtureVulvodynia, 0, {
          'name': null
        } )[ 0 ]
      ];

      const result = mf.bandsintownTransformer.transformEvents( eventWithNullName );

      expect( result[ 0 ].name ).toBe( '' );
      expect( result[ 0 ].date ).toMatch( /^\d{4}-\d{2}-\d{2}$/u );
    } );
  } );

  describe( 'filterPastEvents', () => {
    /**
     * Helper to get UTC midnight of N days ago
     * @param {number} daysAgo - Number of days in the past
     * @returns {string} ISO date string in YYYY-MM-DD format
     */
    const getUtcDateDaysAgo = ( daysAgo ) => {
      const date = new Date();

      date.setUTCHours( 0, 0, 0, 0 );
      date.setUTCDate( date.getUTCDate() - daysAgo );

      return date.toISOString().split( 'T' )[ 0 ];
    };

    /**
     * Test filtering events older than 2 days (UTC)
     */
    test( 'filters out events older than 2 days in UTC', () => {
      const today = getUtcDateDaysAgo( 0 );
      const yesterday = getUtcDateDaysAgo( 1 );
      const twoDaysAgo = getUtcDateDaysAgo( 2 );
      const threeDaysAgo = getUtcDateDaysAgo( 3 );

      const event1 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${threeDaysAgo}T18:00:00Z`
      } );
      const event2 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${twoDaysAgo}T18:00:00Z`
      } );
      const event3 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${yesterday}T18:00:00Z`
      } );
      const event4 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${today}T18:00:00Z`
      } );
      const events = [ event1, event2, event3, event4 ];

      const result = mf.bandsintownTransformer.transformEvents( events );

      expect( result.length ).toBe( 3 );
      expect( result[ 0 ].date ).toBe( twoDaysAgo );
      expect( result[ 1 ].date ).toBe( yesterday );
      expect( result[ 2 ].date ).toBe( today );
    } );

    /**
     * Test that exactly 2 days ago (UTC midnight) is included
     */
    test( 'includes events from exactly 2 calendar days ago', () => {
      const twoDaysAgo = getUtcDateDaysAgo( 2 );
      const event1 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${twoDaysAgo}T00:00:00Z`
      } );
      const event2 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 1 ], {
        'startDate': `${twoDaysAgo}T23:59:59Z`
      } );
      const events = [ event1, event2 ];

      const result = mf.bandsintownTransformer.transformEvents( events );

      expect( result.length ).toBe( 2 );
      expect( result[ 0 ].date ).toBe( twoDaysAgo );
      expect( result[ 1 ].date ).toBe( twoDaysAgo );
    } );

    /**
     * Test that 3 days ago is excluded
     */
    test( 'excludes events from 3 calendar days ago', () => {
      const threeDaysAgo = getUtcDateDaysAgo( 3 );
      const twoDaysAgo = getUtcDateDaysAgo( 2 );
      const event1 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${threeDaysAgo}T23:59:59Z`
      } );
      const event2 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 1 ], {
        'startDate': `${twoDaysAgo}T00:00:00Z`
      } );
      const events = [ event1, event2 ];

      const result = mf.bandsintownTransformer.transformEvents( events );

      expect( result.length ).toBe( 1 );
      expect( result[ 0 ].date ).toBe( twoDaysAgo );
    } );

    /**
     * Test handling of future events
     */
    test( 'includes all future events', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia );

      expect( result.length ).toBe( 4 );
    } );

    /**
     * Test handling of events with missing dates
     */
    test( 'excludes events with missing or invalid dates', () => {
      const today = getUtcDateDaysAgo( 0 );
      const event1 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${today}T18:00:00Z`
      } );
      const event2 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 1 ], {
        'startDate': undefined
      } );
      const event3 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 2 ], {
        'startDate': 'invalid-date'
      } );
      const events = [ event1, event2, event3 ];

      const result = mf.bandsintownTransformer.transformEvents( events );

      expect( result.length ).toBe( 1 );
      expect( result[ 0 ].date ).toBe( today );
    } );

    /**
     * Test timezone-independent filtering
     */
    test( 'filters based on UTC calendar days regardless of local timezone', () => {
      const twoDaysAgo = getUtcDateDaysAgo( 2 );
      const event1 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': `${twoDaysAgo}T00:00:00Z`
      } );
      const event2 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 1 ], {
        'startDate': `${twoDaysAgo}T12:00:00Z`
      } );
      const event3 = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 2 ], {
        'startDate': `${twoDaysAgo}T23:59:59Z`
      } );
      const events = [ event1, event2, event3 ];

      const result = mf.bandsintownTransformer.transformEvents( events );

      expect( result.length ).toBe( 3 );
      result.forEach( ( event ) => {
        expect( event.date ).toBe( twoDaysAgo );
      } );
    } );
  } );
} );
