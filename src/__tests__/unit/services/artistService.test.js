/**
 * Unit tests for artistService pure functions
 * @module __tests__/unit/services/artistService
 */

const artistService = require( '../../../services/artistService' );

describe( 'artistService - Pure Functions', () => {
  describe( 'getBerlinTimestamp', () => {
    /**
     * Test that timestamp is in correct format
     */
    test( 'returns timestamp in YYYY-MM-DD HH:MM:SS format', () => {
      const timestamp = artistService.getBerlinTimestamp();

      expect( timestamp ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ );
    } );

    /**
     * Test that timestamp is a string
     */
    test( 'returns a string', () => {
      const timestamp = artistService.getBerlinTimestamp();

      expect( typeof timestamp ).toBe( 'string' );
    } );

    /**
     * Test that each call returns a valid timestamp
     */
    test( 'returns valid timestamps on consecutive calls', () => {
      const timestamp1 = artistService.getBerlinTimestamp();
      const timestamp2 = artistService.getBerlinTimestamp();

      // Both should be valid
      expect( timestamp1 ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ );
      expect( timestamp2 ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ );

      // Should be same or second is later (depending on timing)
      expect( timestamp2 >= timestamp1 ).toBe( true );
    } );
  } );

  describe( 'determineStatus', () => {
    /**
     * Test returns MusicBrainz status when no events
     */
    test( 'returns MusicBrainz status when events array is empty', () => {
      const result = artistService.determineStatus( [], 'active' );

      expect( result ).toBe( 'active' );
    } );

    /**
     * Test returns MusicBrainz status when events is null
     */
    test( 'returns MusicBrainz status when events is null', () => {
      const result = artistService.determineStatus( null, 'disbanded' );

      expect( result ).toBe( 'disbanded' );
    } );

    /**
     * Test returns MusicBrainz status when events is undefined
     */
    test( 'returns MusicBrainz status when events is undefined', () => {
      const result = artistService.determineStatus( undefined, 'active' );

      expect( result ).toBe( 'active' );
    } );

    /**
     * Test returns "on tour" when event is within 3 months
     */
    test( 'returns "on tour" when nearest event is within 3 months', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 60 ); // 2 months from now
      const dateStr = futureDate.toISOString().split( 'T' )[ 0 ];

      const events = [
        {
          'name': 'Concert',
          'date': dateStr,
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'on tour' );
    } );

    /**
     * Test returns "tour planned" when event is between 3-9 months
     */
    test( 'returns "tour planned" when nearest event is between 3 and 9 months', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 180 ); // 6 months from now
      const dateStr = futureDate.toISOString().split( 'T' )[ 0 ];

      const events = [
        {
          'name': 'Concert',
          'date': dateStr,
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'tour planned' );
    } );

    /**
     * Test returns MusicBrainz status when event is beyond 9 months
     */
    test( 'returns MusicBrainz status when nearest event is beyond 9 months', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 300 ); // 10 months from now
      const dateStr = futureDate.toISOString().split( 'T' )[ 0 ];

      const events = [
        {
          'name': 'Concert',
          'date': dateStr,
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'active' );
    } );

    /**
     * Test uses nearest event when multiple events exist
     */
    test( 'uses nearest event when multiple events exist', () => {
      const date1 = new Date();
      const date2 = new Date();
      const date3 = new Date();

      date1.setUTCDate( date1.getUTCDate() + 200 ); // 7 months
      date2.setUTCDate( date2.getUTCDate() + 60 );  // 2 months (nearest)
      date3.setUTCDate( date3.getUTCDate() + 150 ); // 5 months

      const events = [
        {
          'name': 'Concert 1',
          'date': date1.toISOString().split( 'T' )[ 0 ],
          'location': {}
        },
        {
          'name': 'Concert 2',
          'date': date2.toISOString().split( 'T' )[ 0 ],
          'location': {}
        },
        {
          'name': 'Concert 3',
          'date': date3.toISOString().split( 'T' )[ 0 ],
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      // Should be "on tour" because nearest is 2 months away
      expect( result ).toBe( 'on tour' );
    } );

    /**
     * Test returns MusicBrainz status when all events have invalid dates
     */
    test( 'returns MusicBrainz status when all events have invalid dates', () => {
      const events = [
        {
          'name': 'Event with invalid date',
          'date': 'not-a-valid-date',
          'location': {}
        },
        {
          'name': 'Event with missing date',
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'active' );
    } );

    /**
     * Test ignores events with non-string dates
     */
    test( 'ignores events with non-string dates', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 60 );

      const events = [
        {
          'name': 'Event with number date',
          'date': 12345,
          'location': {}
        },
        {
          'name': 'Event with valid date',
          'date': futureDate.toISOString().split( 'T' )[ 0 ],
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      // Should use the valid event
      expect( result ).toBe( 'on tour' );
    } );

    /**
     * Test ignores events with null dates
     */
    test( 'ignores events with null dates', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 60 );

      const events = [
        {
          'name': 'Event with null date',
          'date': null,
          'location': {}
        },
        {
          'name': 'Event with valid date',
          'date': futureDate.toISOString().split( 'T' )[ 0 ],
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'on tour' );
    } );

    /**
     * Test boundary: exactly 90 days (3 months) counts as "on tour"
     */
    test( 'returns "on tour" when event is exactly 90 days away', () => {
      const futureDate = new Date();

      futureDate.setUTCHours( 0, 0, 0, 0 );
      futureDate.setUTCDate( futureDate.getUTCDate() + 90 );

      const events = [
        {
          'name': 'Concert',
          'date': futureDate.toISOString().split( 'T' )[ 0 ],
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'on tour' );
    } );

    /**
     * Test boundary: exactly 270 days (9 months) counts as "tour planned"
     */
    test( 'returns "tour planned" when event is exactly 270 days away', () => {
      const futureDate = new Date();

      futureDate.setUTCHours( 0, 0, 0, 0 );
      futureDate.setUTCDate( futureDate.getUTCDate() + 270 );

      const events = [
        {
          'name': 'Concert',
          'date': futureDate.toISOString().split( 'T' )[ 0 ],
          'location': {}
        }
      ];

      const result = artistService.determineStatus( events, 'active' );

      expect( result ).toBe( 'tour planned' );
    } );
  } );
} );
