/**
 * Unit tests for artistService module
 * @module __tests__/unit/services/artistService
 */

// Mock dependencies for tests that need them
jest.mock( '../../../services/musicbrainz' );
jest.mock( '../../../services/database' );
jest.mock( '../../../services/ldJsonExtractor' );
jest.mock( '../../../services/bandsintownTransformer' );
jest.mock( '../../../services/musicbrainzTransformer' );

describe( 'artistService', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();
    require( '../../../services/artistService' );
  } );

  describe( 'Pure Functions (No Mocks)', () => {
    describe( 'getBerlinTimestamp', () => {
      test( 'returns timestamp in YYYY-MM-DD HH:MM:SS format', () => {
        const timestamp = mf.artistService.getBerlinTimestamp();

        expect( timestamp ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u );
      } );

      test( 'returns a string', () => {
        const timestamp = mf.artistService.getBerlinTimestamp();

        expect( typeof timestamp ).toBe( 'string' );
      } );

      test( 'returns valid timestamps on consecutive calls', () => {
        const timestamp1 = mf.artistService.getBerlinTimestamp();
        const timestamp2 = mf.artistService.getBerlinTimestamp();

        expect( timestamp1 ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u );
        expect( timestamp2 ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u );
        expect( timestamp2 >= timestamp1 ).toBe( true );
      } );
    } );

    describe( 'determineStatus', () => {
      test( 'returns MusicBrainz status when events array is empty', () => {
        const result = mf.artistService.determineStatus( [], 'active' );

        expect( result ).toBe( 'active' );
      } );

      test( 'returns MusicBrainz status when events is null', () => {
        const result = mf.artistService.determineStatus( null, 'disbanded' );

        expect( result ).toBe( 'disbanded' );
      } );

      test( 'returns MusicBrainz status when events is undefined', () => {
        const result = mf.artistService.determineStatus( undefined, 'active' );

        expect( result ).toBe( 'active' );
      } );

      test( 'returns "on tour" when nearest event is within 3 months', () => {
        const futureDate = new Date();

        futureDate.setUTCDate( futureDate.getUTCDate() + 60 );
        const [ dateStr ] = futureDate.toISOString().split( 'T' );

        const events = [
          {
            'name': 'Concert',
            'date': dateStr,
            'location': {}
          }
        ];

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'on tour' );
      } );

      test( 'returns "tour planned" when nearest event is between 3 and 9 months', () => {
        const futureDate = new Date();

        futureDate.setUTCDate( futureDate.getUTCDate() + 180 );
        const [ dateStr ] = futureDate.toISOString().split( 'T' );

        const events = [
          {
            'name': 'Concert',
            'date': dateStr,
            'location': {}
          }
        ];

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'tour planned' );
      } );

      test( 'returns MusicBrainz status when nearest event is beyond 9 months', () => {
        const futureDate = new Date();

        futureDate.setUTCDate( futureDate.getUTCDate() + 300 );
        const [ dateStr ] = futureDate.toISOString().split( 'T' );

        const events = [
          {
            'name': 'Concert',
            'date': dateStr,
            'location': {}
          }
        ];

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'active' );
      } );

      test( 'uses nearest event when multiple events exist', () => {
        const date1 = new Date();
        const date2 = new Date();
        const date3 = new Date();

        date1.setUTCDate( date1.getUTCDate() + 200 );
        date2.setUTCDate( date2.getUTCDate() + 60 );
        date3.setUTCDate( date3.getUTCDate() + 150 );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'on tour' );
      } );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'active' );
      } );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'on tour' );
      } );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'on tour' );
      } );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'on tour' );
      } );

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

        const result = mf.artistService.determineStatus( events, 'active' );

        expect( result ).toBe( 'tour planned' );
      } );
    } );

    describe( 'withTimeout', () => {
      /**
       * Test that withTimeout resolves when promise resolves before timeout
       */
      test( 'resolves when promise completes before timeout', async () => {
        jest.useFakeTimers();

        const fastPromise = new Promise( ( resolve ) => {
          setTimeout( () => resolve( 'success' ), 100 );
        } );

        const resultPromise = mf.testing.artistService.withTimeout( fastPromise, 1000 );

        jest.advanceTimersByTime( 100 );
        const result = await resultPromise;

        expect( result ).toBe( 'success' );

        jest.useRealTimers();
      } );

      /**
       * Test that withTimeout rejects when timeout is reached
       */
      test( 'rejects with timeout error when promise takes too long', async () => {
        jest.useFakeTimers();

        const slowPromise = new Promise( ( resolve ) => {
          setTimeout( () => resolve( 'too late' ), 2000 );
        } );

        const resultPromise = mf.testing.artistService.withTimeout( slowPromise, 500 );

        jest.advanceTimersByTime( 500 );

        await expect( resultPromise ).rejects.toThrow( 'Database operation timeout' );

        jest.useRealTimers();
      } );

      /**
       * Test that withTimeout rejects when promise rejects
       */
      test( 'rejects when promise rejects before timeout', async () => {
        jest.useFakeTimers();

        const rejectingPromise = new Promise( ( _, reject ) => {
          setTimeout( () => reject( new Error( 'Operation failed' ) ), 100 );
        } );

        const resultPromise = mf.testing.artistService.withTimeout( rejectingPromise, 1000 );

        jest.advanceTimersByTime( 100 );

        await expect( resultPromise ).rejects.toThrow( 'Operation failed' );

        jest.useRealTimers();
      } );
    } );
  } );

  describe( 'Functions with Mocked Dependencies', () => {
    let ldJsonExtractor;
    let bandsintownTransformer;
    let musicbrainzTransformer;
    let fetchQueue;

    beforeEach( () => {
      jest.clearAllMocks();
      jest.resetModules();
      jest.useFakeTimers();

      // Require database module (sets up mf.database with real implementations)
      require( '../../../services/database' );

      // Mock only the database functions used by artistService
      mf.database.connect = jest.fn();
      mf.database.testCacheHealth = jest.fn();
      mf.database.getArtistFromCache = jest.fn();
      mf.database.cacheArtist = jest.fn();

      require( '../../../services/musicbrainz' );
      mf.musicbrainz.fetchArtist = jest.fn();
      ldJsonExtractor = require( '../../../services/ldJsonExtractor' );
      bandsintownTransformer = require( '../../../services/bandsintownTransformer' );
      musicbrainzTransformer = require( '../../../services/musicbrainzTransformer' );

      jest.doMock( '../../../services/fetchQueue', () => ( {
        'triggerBackgroundFetch': jest.fn()
      } ) );

      fetchQueue = require( '../../../services/fetchQueue' );
      require( '../../../services/artistService' );
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    describe( 'fetchBandsintownEvents', () => {
      test( 'returns empty array when artist has no Bandsintown relation', async () => {
        const artistData = {
          '_id': 'test-id',
          'name': 'Test Artist',
          'relations': {}
        };

        const result = await mf.artistService.fetchBandsintownEvents( artistData );

        expect( result ).toEqual( [] );
        expect( ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
      } );

      test( 'returns empty array when artist has no relations', async () => {
        const artistData = {
          '_id': 'test-id',
          'name': 'Test Artist'
        };

        const result = await mf.artistService.fetchBandsintownEvents( artistData );

        expect( result ).toEqual( [] );
      } );

      test( 'fetches and transforms events when Bandsintown URL exists', async () => {
        const artistData = {
          '_id': 'test-id',
          'name': 'Test Artist',
          'relations': {
            'bandsintown': 'https://bandsintown.com/a/12345'
          }
        };

        const mockLdJson = { 'events': [ { 'name': 'Concert' } ] };
        const mockTransformedEvents = [
          {
            'name': 'Concert',
            'date': '2025-12-01',
            'location': {}
          }
        ];

        ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( mockLdJson );
        bandsintownTransformer.transformEvents.mockReturnValue( mockTransformedEvents );

        const result = await mf.artistService.fetchBandsintownEvents( artistData );

        expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://bandsintown.com/a/12345' );
        expect( bandsintownTransformer.transformEvents ).toHaveBeenCalledWith( mockLdJson );
        expect( result ).toEqual( mockTransformedEvents );
      } );

      test( 'throws error on fetch failure when silentFail is false', async () => {
        const artistData = {
          'relations': {
            'bandsintown': 'https://bandsintown.com/a/12345'
          }
        };

        ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Fetch failed' ) );

        await expect( mf.artistService.fetchBandsintownEvents( artistData, false ) ).rejects.toThrow( 'Fetch failed' );
      } );

      test( 'returns empty array on fetch failure when silentFail is true', async () => {
        const artistData = {
          'relations': {
            'bandsintown': 'https://bandsintown.com/a/12345'
          }
        };

        ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Fetch failed' ) );

        const result = await mf.artistService.fetchBandsintownEvents( artistData, true );

        expect( result ).toEqual( [] );
      } );
    } );

    describe( 'fetchAndEnrichArtistData', () => {
      test( 'fetches MusicBrainz data and enriches with events and status', async () => {
        const mockMbData = {
          'id': 'test-id',
          'name': 'Test Artist'
        };
        const mockTransformed = {
          '_id': 'test-id',
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

        mf.musicbrainz.fetchArtist.mockResolvedValue( mockMbData );
        musicbrainzTransformer.transformArtistData.mockReturnValue( mockTransformed );
        ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( {} );
        bandsintownTransformer.transformEvents.mockReturnValue( mockEvents );

        const result = await mf.artistService.fetchAndEnrichArtistData( 'test-id' );

        expect( mf.musicbrainz.fetchArtist ).toHaveBeenCalledWith( 'test-id' );
        expect( musicbrainzTransformer.transformArtistData ).toHaveBeenCalledWith( mockMbData );
        expect( result ).toMatchObject( {
          '_id': 'test-id',
          'name': 'Test Artist',
          'events': mockEvents
        } );
        expect( result.updatedAt ).toBeDefined();
        expect( result.status ).toBeDefined();
      } );

      test( 'passes silentEventFail=true to fetchBandsintownEvents', async () => {
        const mockMbData = { 'id': 'test-id' };
        const mockTransformed = {
          '_id': 'test-id',
          'status': 'active',
          'relations': {
            'bandsintown': 'https://bandsintown.com/a/12345'
          }
        };

        mf.musicbrainz.fetchArtist.mockResolvedValue( mockMbData );
        musicbrainzTransformer.transformArtistData.mockReturnValue( mockTransformed );
        ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Fetch failed' ) );

        const result = await mf.artistService.fetchAndEnrichArtistData( 'test-id', true );

        expect( result.events ).toEqual( [] );
      } );
    } );

    describe( 'fetchMultipleActs - cache health and error handling', () => {
      test( 'reconnects and tests cache health when cache is unhealthy', async () => {
        jest.useRealTimers();

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.mockRejectedValue( new Error( 'Cache error' ) );

        try {
          await mf.artistService.fetchMultipleActs( [ 'id1' ] );
        } catch ( error ) {
          // Expected SVC_002 error
        }

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.mockResolvedValue( { '_id': 'id1',
          'name': 'Test' } );

        const result = await mf.artistService.fetchMultipleActs( [ 'id1' ] );

        expect( mf.database.connect ).toHaveBeenCalled();
        expect( mf.database.testCacheHealth ).toHaveBeenCalled();
        expect( result.acts ).toBeDefined();
      } );

      test( 'throws SVC_001 error when cache health check fails', async () => {
        jest.useRealTimers();

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.mockRejectedValue( new Error( 'Cache error' ) );

        try {
          await mf.artistService.fetchMultipleActs( [ 'id1' ] );
        } catch ( error ) {
          // Cache is now unhealthy
        }

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockRejectedValue( new Error( 'Health check failed' ) );

        await expect( mf.artistService.fetchMultipleActs( [ 'id1' ] ) ).
          rejects.
          toThrow( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );
      } );

      test( 'throws SVC_002 and flags cache unhealthy when cache read fails', async () => {
        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.mockRejectedValue( new Error( 'Cache error' ) );

        await expect( mf.artistService.fetchMultipleActs( [ 'id1' ] ) ).
          rejects.
          toThrow( 'Service temporarily unavailable. Please try again later. (Error: SVC_002)' );
      } );

      test( 'sets cacheHealthy to false when cacheArtist fails', async () => {
        jest.useRealTimers();

        const artistIds = [ 'id1', 'id2' ];
        const mockCached = {
          '_id': 'id1',
          'name': 'Artist 1'
        };
        const mockMbData = {
          'id': 'id2',
          'name': 'Artist 2'
        };
        const mockTransformed = {
          '_id': 'id2',
          'name': 'Artist 2',
          'status': 'active'
        };

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.
          mockResolvedValueOnce( mockCached ).
          mockResolvedValueOnce( null );
        mf.musicbrainz.fetchArtist.mockResolvedValue( mockMbData );
        musicbrainzTransformer.transformArtistData.mockReturnValue( mockTransformed );
        ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( {} );
        bandsintownTransformer.transformEvents.mockReturnValue( [] );
        mf.database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

        const result = await mf.artistService.fetchMultipleActs( artistIds );

        expect( result.acts ).toHaveLength( 2 );

        mf.database.connect.mockClear();
        mf.database.testCacheHealth.mockClear();
        mf.database.getArtistFromCache.mockResolvedValue( mockCached );

        await mf.artistService.fetchMultipleActs( [ 'id1' ] );

        expect( mf.database.connect ).toHaveBeenCalled();
        expect( mf.database.testCacheHealth ).toHaveBeenCalled();
      } );
    } );

    describe( 'fetchMultipleActs - basic validation', () => {
      test( 'returns error when artistIds is not an array', async () => {
        const result = await mf.artistService.fetchMultipleActs( 'not-an-array' );

        expect( result ).toEqual( {
          'error': {
            'message': 'Invalid input: artistIds must be a non-empty array'
          }
        } );
      } );

      test( 'returns error when artistIds is empty array', async () => {
        const result = await mf.artistService.fetchMultipleActs( [] );

        expect( result ).toEqual( {
          'error': {
            'message': 'Invalid input: artistIds must be a non-empty array'
          }
        } );
      } );

      test( 'returns all cached acts when all are in cache', async () => {
        const artistIds = [ 'id1', 'id2' ];
        const mockCached = [
          {
            '_id': 'id1',
            'name': 'Artist 1'
          },
          {
            '_id': 'id2',
            'name': 'Artist 2'
          }
        ];

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.
          mockResolvedValueOnce( mockCached[ 0 ] ).
          mockResolvedValueOnce( mockCached[ 1 ] );

        const result = await mf.artistService.fetchMultipleActs( artistIds );

        expect( result ).toEqual( {
          'acts': mockCached
        } );
      } );

      test( 'fetches and caches single missing act', async () => {
        jest.useRealTimers();

        const artistIds = [ 'id1', 'id2' ];
        const mockCached = {
          '_id': 'id1',
          'name': 'Artist 1'
        };
        const mockMbData = {
          'id': 'id2',
          'name': 'Artist 2'
        };
        const mockTransformed = {
          '_id': 'id2',
          'name': 'Artist 2',
          'status': 'active'
        };

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.
          mockResolvedValueOnce( mockCached ).
          mockResolvedValueOnce( null );
        mf.musicbrainz.fetchArtist.mockResolvedValue( mockMbData );
        musicbrainzTransformer.transformArtistData.mockReturnValue( mockTransformed );
        ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( {} );
        bandsintownTransformer.transformEvents.mockReturnValue( [] );
        mf.database.cacheArtist.mockResolvedValue();

        const result = await mf.artistService.fetchMultipleActs( artistIds );

        expect( result.acts ).toHaveLength( 2 );
        expect( result.acts[ 0 ] ).toEqual( mockCached );
        expect( result.acts[ 1 ].musicbrainzId ).toBe( 'id2' );
      } );

      test( 'triggers background fetch for multiple missing acts', async () => {
        const artistIds = [ 'id1', 'id2', 'id3' ];
        const mockCached = {
          '_id': 'id1',
          'name': 'Artist 1'
        };

        mf.database.connect.mockResolvedValue();
        mf.database.testCacheHealth.mockResolvedValue();
        mf.database.getArtistFromCache.
          mockResolvedValueOnce( mockCached ).
          mockResolvedValueOnce( null ).
          mockResolvedValueOnce( null );

        const result = await mf.artistService.fetchMultipleActs( artistIds );

        expect( fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ 'id2', 'id3' ] );
        expect( result ).toEqual( {
          'error': {
            'message': '2 acts not cached. Background fetch initiated. Please try again in a few minutes.',
            'missingCount': 2,
            'cachedCount': 1
          }
        } );
      } );
    } );
  } );
} );
