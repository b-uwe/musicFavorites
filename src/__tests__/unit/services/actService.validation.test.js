/**
 * Unit tests for actService data validation logging
 * @module __tests__/unit/services/actService.validation
 */

describe( 'actService - Data Validation Logging', () => {
  let debugSpy;
  let warnSpy;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();
    require( '../../../services/actService' );

    // Spy on logger methods
    debugSpy = jest.spyOn( mf.logger, 'debug' ).mockImplementation( () => {
      // Mock implementation
    } );
    warnSpy = jest.spyOn( mf.logger, 'warn' ).mockImplementation( () => {
      // Mock implementation
    } );
  } );

  afterEach( () => {
    if ( debugSpy ) {
      debugSpy.mockRestore();
    }
    if ( warnSpy ) {
      warnSpy.mockRestore();
    }
  } );

  describe( 'fetchBandsintownEvents - Event Filtering Logging', () => {
    /**
     * Test logging when some events are filtered
     */
    test( 'logs debug when some Bandsintown events are filtered', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      // Mock LD+JSON data with 5 raw events
      const mockLdJson = [
        { 'name': 'Event 1' },
        { 'name': 'Event 2' },
        { 'name': 'Event 3' },
        { 'name': 'Event 4' },
        { 'name': 'Event 5' }
      ];

      // But transformer only returns 3 valid events (2 filtered out)
      const mockTransformedEvents = [
        {
          'name': 'Event 1',
          'date': '2025-12-01',
          'location': {}
        },
        {
          'name': 'Event 2',
          'date': '2025-12-02',
          'location': {}
        },
        {
          'name': 'Event 3',
          'date': '2025-12-03',
          'location': {}
        }
      ];

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockTransformedEvents );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should log debug about filtered events
      expect( debugSpy ).toHaveBeenCalledWith(
        {
          'actId': 'test-id',
          'rawEventCount': 5,
          'validEventCount': 3,
          'filteredCount': 2
        },
        'Some Bandsintown events filtered during transformation'
      );
    } );

    /**
     * Test warning when ALL events are filtered
     */
    test( 'logs warning when all Bandsintown events are filtered', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      // Mock LD+JSON data with 3 raw events
      const mockLdJson = [
        { 'name': 'Event 1' },
        { 'name': 'Event 2' },
        { 'name': 'Event 3' }
      ];

      // But transformer returns empty array (all filtered)
      const mockTransformedEvents = [];

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockTransformedEvents );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should log warning about all events filtered
      expect( warnSpy ).toHaveBeenCalledWith(
        {
          'actId': 'test-id',
          'rawEventCount': 3,
          'issue': 'all_events_filtered'
        },
        'All Bandsintown events were filtered out'
      );
    } );

    /**
     * Test no logging when all events are valid (no filtering)
     */
    test( 'does not log when all events are valid (no filtering)', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockLdJson = [
        { 'name': 'Event 1' },
        { 'name': 'Event 2' }
      ];

      const mockTransformedEvents = [
        {
          'name': 'Event 1',
          'date': '2025-12-01',
          'location': {}
        },
        {
          'name': 'Event 2',
          'date': '2025-12-02',
          'location': {}
        }
      ];

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockTransformedEvents );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should not log validation warnings/debug when no filtering occurred
      expect( debugSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'filteredCount': expect.any( Number ) } ),
        'Some Bandsintown events filtered during transformation'
      );
      expect( warnSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'all_events_filtered' } ),
        'All Bandsintown events were filtered out'
      );
    } );

    /**
     * Test no logging when LD+JSON is empty (no raw events)
     */
    test( 'does not log when LD+JSON returns no events', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockLdJson = [];
      const mockTransformedEvents = [];

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockTransformedEvents );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should not log when there were no events to begin with
      expect( warnSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'all_events_filtered' } ),
        expect.any( String )
      );
    } );
  } );

  describe( 'fetchAndEnrichActData - Data Quality Logging', () => {
    /**
     * Test logging when act has no relations and no events
     */
    test( 'logs warning when act has no relations and no Bandsintown events', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      // No relations
      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'relations': {}
      };

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );

      // Mock no Bandsintown events
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( [] );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should log warning about minimal data
      expect( warnSpy ).toHaveBeenCalledWith(
        {
          actId,
          'issue': 'minimal_data'
        },
        'Act has no relations and no Bandsintown events'
      );
    } );

    /**
     * Test logging when act has no location data
     */
    test( 'logs debug when act has no country or region data', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'relations': {
          'official': 'https://example.com'
        }
        // No country or region
      };

      const mockEvents = [
        {
          'name': 'Concert',
          'date': '2025-12-01',
          'location': {}
        }
      ];

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( mockEvents );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should log debug about missing location
      expect( debugSpy ).toHaveBeenCalledWith(
        {
          actId,
          'issue': 'no_location'
        },
        'Act has no country or region data'
      );
    } );

    /**
     * Test no data quality warnings when act has good data
     */
    test( 'does not log data quality warnings when act has complete data', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'country': 'Germany',
        'region': 'Berlin',
        'relations': {
          'official': 'https://example.com',
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockEvents = [
        {
          'name': 'Concert',
          'date': '2025-12-01',
          'location': {}
        }
      ];

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( mockEvents );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should not log data quality warnings
      expect( warnSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'minimal_data' } ),
        expect.any( String )
      );
      expect( debugSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'no_location' } ),
        expect.any( String )
      );
    } );

    /**
     * Test logging when act has relations but no events (not minimal data)
     */
    test( 'does not log minimal_data when act has relations', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'relations': {
          'official': 'https://example.com'
        }
      };

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( [] );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should not log minimal_data because it has relations
      expect( warnSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'minimal_data' } ),
        expect.any( String )
      );
    } );

    /**
     * Test logging when act has events but no relations (not minimal data)
     */
    test( 'does not log minimal_data when act has events', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockEvents = [
        {
          'name': 'Concert',
          'date': '2025-12-01',
          'location': {}
        }
      ];

      const mockLdJson = [ { 'event': 'data' } ];

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockEvents );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should not log minimal_data because it has events
      expect( warnSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'minimal_data' } ),
        expect.any( String )
      );
    } );

    /**
     * Test no location warning when act has country but no region
     */
    test( 'does not log no_location when act has country', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'country': 'Germany',
        'relations': {
          'official': 'https://example.com'
        }
      };

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( [] );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should not log no_location because it has country
      expect( debugSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'no_location' } ),
        expect.any( String )
      );
    } );

    /**
     * Test no location warning when act has region but no country
     */
    test( 'does not log no_location when act has region', async () => {
      const actId = 'test-id';

      const mockMbData = {
        'id': actId,
        'name': 'Test Artist'
      };

      const mockTransformed = {
        '_id': actId,
        'name': 'Test Artist',
        'status': 'active',
        'region': 'Berlin',
        'relations': {
          'official': 'https://example.com'
        }
      };

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( [] );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should not log no_location because it has region
      expect( debugSpy ).not.toHaveBeenCalledWith(
        expect.objectContaining( { 'issue': 'no_location' } ),
        expect.any( String )
      );
    } );
  } );
} );
