/**
 * Unit tests for bandsintownTransformer - Rejection Tracking
 * @module __tests__/unit/transformers/bandsintownTransformer.rejectionTracking
 */

const fixtureVulvodynia = require( '../../fixtures/ldjson/bandsintown-vulvodynia.json' );

require( '../../../services/bandsintownTransformer' );
require( '../../../testHelpers/fixtureHelpers' );

describe( 'bandsintownTransformer - Rejection Tracking', () => {
  describe( 'transformEvents with rejection tracking (includeRejected=true)', () => {
    /**
     * Test structure of returned object with includeRejected flag
     */
    test( 'returns object with events and rejected arrays when includeRejected=true', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia, true );

      expect( result ).toHaveProperty( 'events' );
      expect( result ).toHaveProperty( 'rejected' );
      expect( Array.isArray( result.events ) ).toBe( true );
      expect( Array.isArray( result.rejected ) ).toBe( true );
    } );

    /**
     * Test backward compatibility - returns array when includeRejected=false
     */
    test( 'returns array when includeRejected=false (backward compatible)', () => {
      const result = mf.bandsintownTransformer.transformEvents( fixtureVulvodynia, false );

      expect( Array.isArray( result ) ).toBe( true );
      expect( result ).not.toHaveProperty( 'events' );
      expect( result ).not.toHaveProperty( 'rejected' );
    } );

    /**
     * Test rejection reason: wrong_type
     */
    test( 'tracks wrong_type rejection when @type is not MusicEvent', () => {
      // Use only MusicEvents from fixture, then add our test Organization
      const musicEventsOnly = fixtureVulvodynia.filter( ( item ) => item[ '@type' ] === 'MusicEvent' );
      const mixedData = [
        ...musicEventsOnly,
        {
          '@type': 'Organization',
          'name': 'Test Organization',
          'startDate': fixtureVulvodynia[ 0 ].startDate
        }
      ];

      const result = mf.bandsintownTransformer.transformEvents( mixedData, true );

      expect( result.events.length ).toBe( 4 );
      expect( result.rejected.length ).toBe( 1 );
      expect( result.rejected[ 0 ] ).toEqual( {
        'reason': 'wrong_type',
        'type': 'Organization',
        'name': 'Test Organization'
      } );
    } );

    /**
     * Test rejection reason: date_out_of_range
     */
    test( 'tracks date_out_of_range rejection for old events', () => {
      const oldEvent = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'startDate': '2020-01-01T18:00:00Z'
      } );
      const events = [ oldEvent ];

      const result = mf.bandsintownTransformer.transformEvents( events, true );

      expect( result.events.length ).toBe( 0 );
      expect( result.rejected.length ).toBe( 1 );
      expect( result.rejected[ 0 ] ).toEqual( {
        'reason': 'date_out_of_range',
        'date': '2020-01-01T18:00:00Z',
        'name': 'Vulvodynia @ O2 Academy Islington'
      } );
    } );

    /**
     * Test rejection reason: missing_name
     */
    test( 'tracks missing_name rejection when event has no name', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 30 );

      const eventWithoutName = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'name': null,
        'startDate': futureDate.toISOString()
      } );
      const events = [ eventWithoutName ];

      const result = mf.bandsintownTransformer.transformEvents( events, true );

      expect( result.events.length ).toBe( 0 );
      expect( result.rejected.length ).toBe( 1 );
      expect( result.rejected[ 0 ] ).toEqual( {
        'reason': 'missing_name',
        'date': futureDate.toISOString()
      } );
    } );

    /**
     * Test multiple rejection reasons in single call
     */
    test( 'tracks multiple different rejection reasons', () => {
      const futureDate = new Date();

      futureDate.setUTCDate( futureDate.getUTCDate() + 30 );

      // Valid event
      const events = [
        fixtureVulvodynia[ 0 ],
        {
          '@type': 'Event',
          'name': 'Wrong Type Event',
          'startDate': futureDate.toISOString()
        },
        mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 1 ], {
          'startDate': '2019-01-01T18:00:00Z'
        } ),
        mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 2 ], {
          'name': undefined,
          'startDate': futureDate.toISOString()
        } )
      ];

      const result = mf.bandsintownTransformer.transformEvents( events, true );

      expect( result.events.length ).toBe( 1 );
      expect( result.rejected.length ).toBe( 3 );
      expect( result.rejected[ 0 ].reason ).toBe( 'wrong_type' );
      expect( result.rejected[ 1 ].reason ).toBe( 'date_out_of_range' );
      expect( result.rejected[ 2 ].reason ).toBe( 'missing_name' );
    } );

    /**
     * Test empty rejected array when all events valid
     */
    test( 'returns empty rejected array when all events are valid', () => {
      // Filter to only MusicEvents to avoid rejections
      const musicEventsOnly = fixtureVulvodynia.filter( ( item ) => item[ '@type' ] === 'MusicEvent' );
      const result = mf.bandsintownTransformer.transformEvents( musicEventsOnly, true );

      expect( result.events.length ).toBe( 4 );
      expect( result.rejected.length ).toBe( 0 );
    } );

    /**
     * Test handling of null/undefined with includeRejected
     */
    test( 'returns empty events and rejected arrays for null input with includeRejected', () => {
      const result = mf.bandsintownTransformer.transformEvents( null, true );

      expect( result ).toEqual( {
        'events': [],
        'rejected': []
      } );
    } );

    /**
     * Test rejection includes "unknown" for missing name in wrong_type
     */
    test( 'uses "unknown" for name when rejecting wrong_type without name', () => {
      const eventWithoutName = {
        '@type': 'Organization',
        'startDate': fixtureVulvodynia[ 0 ].startDate
      };

      const result = mf.bandsintownTransformer.transformEvents( [ eventWithoutName ], true );

      expect( result.rejected.length ).toBe( 1 );
      expect( result.rejected[ 0 ] ).toEqual( {
        'reason': 'wrong_type',
        'type': 'Organization',
        'name': 'unknown'
      } );
    } );

    /**
     * Test rejection includes "unknown" for missing name in date_out_of_range
     */
    test( 'uses "unknown" for name when rejecting date_out_of_range without name', () => {
      const oldEventWithoutName = mf.testing.fixtureHelpers.modifyFixture( fixtureVulvodynia[ 0 ], {
        'name': undefined,
        'startDate': '2020-01-01T18:00:00Z'
      } );

      const result = mf.bandsintownTransformer.transformEvents( [ oldEventWithoutName ], true );

      expect( result.rejected.length ).toBe( 1 );
      expect( result.rejected[ 0 ] ).toEqual( {
        'reason': 'date_out_of_range',
        'date': '2020-01-01T18:00:00Z',
        'name': 'unknown'
      } );
    } );
  } );
} );
