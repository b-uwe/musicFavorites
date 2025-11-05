/**
 * Unit tests for actService data validation logging
 * @module __tests__/unit/services/actService.validation
 */

describe( 'actService - Data Validation Logging', () => {
  let errorSpy;
  let warnSpy;
  let infoSpy;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();
    require( '../../../services/actService' );

    // Spy on logger methods
    errorSpy = jest.spyOn( mf.logger, 'error' ).mockImplementation( () => {
      // Mock implementation
    } );
    warnSpy = jest.spyOn( mf.logger, 'warn' ).mockImplementation( () => {
      // Mock implementation
    } );
    infoSpy = jest.spyOn( mf.logger, 'info' ).mockImplementation( () => {
      // Mock implementation
    } );
  } );

  afterEach( () => {
    if ( errorSpy ) {
      errorSpy.mockRestore();
    }
    if ( warnSpy ) {
      warnSpy.mockRestore();
    }
    if ( infoSpy ) {
      infoSpy.mockRestore();
    }
  } );

  describe( 'fetchBandsintownEvents - Invalid URL Logging', () => {
    /**
     * Test ERROR logging when Bandsintown URL format is invalid
     */
    test( 'logs ERROR when Bandsintown URL format is invalid', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://malicious-site.com/fake'
        }
      };

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should log ERROR about invalid URL
      expect( errorSpy ).toHaveBeenCalledWith(
        {
          'actId': 'test-id',
          'invalidUrl': 'https://malicious-site.com/fake',
          'issue': 'invalid_bandsintown_url'
        },
        'Invalid Bandsintown URL format - possible attack or data corruption'
      );
    } );

    /**
     * Test no ERROR logging when URL is valid
     */
    test( 'does not log ERROR when Bandsintown URL is valid', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockLdJson = [
        {
          '@type': 'MusicEvent',
          'name': 'Concert',
          'startDate': '2025-12-01T18:00:00'
        }
      ];

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( {
        'events': [
          {
            'name': 'Concert',
            'date': '2025-12-01',
            'location': {}
          }
        ],
        'rejected': []
      } );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should not log ERROR
      expect( errorSpy ).not.toHaveBeenCalled();
    } );

    /**
     * Test no logging when there's no Bandsintown URL
     */
    test( 'does not log when there is no Bandsintown URL', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {}
      };

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should not log anything
      expect( errorSpy ).not.toHaveBeenCalled();
      expect( warnSpy ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'fetchBandsintownEvents - Broken Event Data Logging', () => {
    /**
     * Test WARN logging when events are rejected
     */
    test( 'logs WARN when some events are rejected during transformation', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockLdJson = [
        {
          '@type': 'MusicEvent',
          'name': 'Valid Event',
          'startDate': '2025-12-01T18:00:00'
        },
        {
          '@type': 'Event',
          'name': 'Wrong Type',
          'startDate': '2025-12-02T18:00:00'
        }
      ];

      const mockResult = {
        'events': [
          {
            'name': 'Valid Event',
            'date': '2025-12-01',
            'location': {}
          }
        ],
        'rejected': [
          {
            'reason': 'wrong_type',
            'type': 'Event',
            'name': 'Wrong Type'
          }
        ]
      };

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockResult );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should log WARN about rejected events
      expect( warnSpy ).toHaveBeenCalledWith(
        {
          'actId': 'test-id',
          'rejectedCount': 1,
          'rejectedEvents': [
            {
              'reason': 'wrong_type',
              'type': 'Event',
              'name': 'Wrong Type'
            }
          ],
          'issue': 'broken_event_data'
        },
        'Bandsintown events rejected during transformation'
      );
    } );

    /**
     * Test no WARN logging when all events are valid
     */
    test( 'does not log WARN when all events are valid', async () => {
      const artistData = {
        'musicbrainzId': 'test-id',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockLdJson = [
        {
          '@type': 'MusicEvent',
          'name': 'Concert',
          'startDate': '2025-12-01T18:00:00'
        }
      ];

      const mockResult = {
        'events': [
          {
            'name': 'Concert',
            'date': '2025-12-01',
            'location': {}
          }
        ],
        'rejected': []
      };

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( mockLdJson );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockResult );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should not log WARN
      expect( warnSpy ).not.toHaveBeenCalled();
    } );

    /**
     * Test multiple rejection reasons
     */
    test( 'logs all rejection reasons when multiple issues exist', async () => {
      const artistData = {
        '_id': 'test-id-2',
        'relations': {
          'bandsintown': 'https://bandsintown.com/a/12345'
        }
      };

      const mockResult = {
        'events': [],
        'rejected': [
          {
            'reason': 'wrong_type',
            'type': 'Event',
            'name': 'Not MusicEvent'
          },
          {
            'reason': 'date_out_of_range',
            'date': '2020-01-01T18:00:00',
            'name': 'Old Event'
          },
          {
            'reason': 'missing_name',
            'date': '2025-12-01T18:00:00'
          }
        ]
      };

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( mockResult );

      await mf.actService.fetchBandsintownEvents( artistData );

      // Should log all rejection reasons
      expect( warnSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'actId': 'test-id-2',
          'rejectedCount': 3,
          'rejectedEvents': expect.arrayContaining( [
            expect.objectContaining( { 'reason': 'wrong_type' } ),
            expect.objectContaining( { 'reason': 'date_out_of_range' } ),
            expect.objectContaining( { 'reason': 'missing_name' } )
          ] )
        } ),
        'Bandsintown events rejected during transformation'
      );
    } );
  } );

  describe( 'fetchAndEnrichActData - hasSongkick Tracking', () => {
    /**
     * Test hasSongkick true when Songkick relation exists
     */
    test( 'logs hasSongkick as true when act has Songkick relation', async () => {
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
          'official': 'https://example.com',
          'songkick': 'https://songkick.com/artists/12345'
        }
      };

      mf.musicbrainz.fetchAct = jest.fn().mockResolvedValue( mockMbData );
      mf.musicbrainzTransformer.transformActData = jest.fn().mockReturnValue( mockTransformed );
      jest.spyOn( mf.actService, 'fetchBandsintownEvents' ).mockResolvedValue( [] );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should log hasSongkick as true
      expect( infoSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          actId,
          'hasBandsintown': false,
          'hasSongkick': true
        } ),
        'Act enrichment completed'
      );
    } );

    /**
     * Test hasSongkick false when no Songkick relation
     */
    test( 'logs hasSongkick as false when act has no Songkick relation', async () => {
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

      // Should log hasSongkick as false
      expect( infoSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          actId,
          'hasBandsintown': false,
          'hasSongkick': false
        } ),
        'Act enrichment completed'
      );
    } );

    /**
     * Test both hasBandsintown and hasSongkick true
     */
    test( 'logs both hasBandsintown and hasSongkick when both exist', async () => {
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
          'bandsintown': 'https://bandsintown.com/a/12345',
          'songkick': 'https://songkick.com/artists/12345'
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

      mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( {
        'events': mockEvents,
        'rejected': []
      } );

      await mf.actService.fetchAndEnrichActData( actId );

      // Should log both as true
      expect( infoSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          actId,
          'hasBandsintown': true,
          'hasSongkick': true,
          'eventCount': 1
        } ),
        'Act enrichment completed'
      );
    } );
  } );
} );
