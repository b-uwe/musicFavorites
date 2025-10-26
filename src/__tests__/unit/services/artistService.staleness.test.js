/**
 * Unit tests for artistService cache staleness checking
 * @module __tests__/unit/services/artistService.staleness
 */

describe( 'artistService - cache staleness checking', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Load modules
    require( '../../../services/database' );
    require( '../../../services/musicbrainz' );
    require( '../../../services/ldJsonExtractor' );
    require( '../../../services/bandsintownTransformer' );
    require( '../../../services/musicbrainzTransformer' );
    require( '../../../services/fetchQueue' );
    require( '../../../services/cacheUpdater' );
    require( '../../../services/artistService' );

    // Spy on database functions
    jest.spyOn( mf.database, 'connect' ).mockResolvedValue();
    jest.spyOn( mf.database, 'testCacheHealth' ).mockResolvedValue();
    jest.spyOn( mf.database, 'getArtistFromCache' ).mockResolvedValue( null );
    jest.spyOn( mf.database, 'cacheArtist' ).mockResolvedValue();

    // Spy on other service functions
    jest.spyOn( mf.musicbrainz, 'fetchArtist' ).mockResolvedValue( {} );
    jest.spyOn( mf.ldJsonExtractor, 'fetchAndExtractLdJson' ).mockResolvedValue( {} );
    jest.spyOn( mf.fetchQueue, 'triggerBackgroundFetch' ).mockImplementation( () => {
      // No-op - background fetch is mocked for tests
    } );
  } );

  afterEach( () => {
    jest.restoreAllMocks();
  } );

  describe( 'fetchMultipleActs staleness detection', () => {
    test( 'does not trigger refresh when no acts are cached', async () => {
      mf.database.getArtistFromCache.mockResolvedValue( null );
      mf.musicbrainz.fetchArtist.mockResolvedValue( {
        'id': 'id1',
        'name': 'Test Artist'
      } );
      mf.musicbrainzTransformer.transformArtistData = jest.fn().mockReturnValue( {
        '_id': 'id1',
        'name': 'Test Artist',
        'status': 'active'
      } );
      mf.bandsintownTransformer.transformEvents = jest.fn().mockReturnValue( [] );

      const result = await mf.artistService.fetchMultipleActs( [ 'id1' ] );

      expect( result.acts ).toHaveLength( 1 );
      expect( mf.fetchQueue.triggerBackgroundFetch ).not.toHaveBeenCalled();
    } );

    test( 'returns fresh cached acts without triggering background refresh', async () => {
      const now = new Date();
      const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );
      const formattedTimestamp = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

      const mockCached = [
        {
          '_id': 'id1',
          'name': 'Artist 1',
          'updatedAt': formattedTimestamp
        },
        {
          '_id': 'id2',
          'name': 'Artist 2',
          'updatedAt': formattedTimestamp
        }
      ];

      mf.database.getArtistFromCache.
        mockResolvedValueOnce( mockCached[ 0 ] ).
        mockResolvedValueOnce( mockCached[ 1 ] );

      const result = await mf.artistService.fetchMultipleActs( [ 'id1', 'id2' ] );

      expect( result ).toEqual( {
        'acts': mockCached
      } );
      expect( mf.fetchQueue.triggerBackgroundFetch ).not.toHaveBeenCalled();
    } );

    test( 'returns stale cached acts and triggers background refresh', async () => {
      const now = new Date();
      const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );
      const formattedTimestamp = staleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

      const mockCached = [
        {
          '_id': 'id1',
          'name': 'Artist 1',
          'updatedAt': formattedTimestamp
        },
        {
          '_id': 'id2',
          'name': 'Artist 2',
          'updatedAt': formattedTimestamp
        }
      ];

      mf.database.getArtistFromCache.
        mockResolvedValueOnce( mockCached[ 0 ] ).
        mockResolvedValueOnce( mockCached[ 1 ] );

      const result = await mf.artistService.fetchMultipleActs( [ 'id1', 'id2' ] );

      expect( result ).toEqual( {
        'acts': mockCached
      } );
      expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ 'id1', 'id2' ] );
    } );

    test( 'triggers background refresh for acts with missing updatedAt', async () => {
      const mockCached = {
        '_id': 'id1',
        'name': 'Artist 1'
      };

      mf.database.getArtistFromCache.mockResolvedValueOnce( mockCached );

      const result = await mf.artistService.fetchMultipleActs( [ 'id1' ] );

      expect( result ).toEqual( {
        'acts': [ mockCached ]
      } );
      expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ 'id1' ] );
    } );

    test( 'triggers refresh only for stale acts in mixed scenario', async () => {
      const now = new Date();
      const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );
      const staleTimestamp = new Date( now.getTime() - ( 25 * 60 * 60 * 1000 ) );
      const freshFormatted = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );
      const staleFormatted = staleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

      const mockCached = [
        {
          '_id': 'id1',
          'name': 'Artist 1',
          'updatedAt': freshFormatted
        },
        {
          '_id': 'id2',
          'name': 'Artist 2',
          'updatedAt': staleFormatted
        },
        {
          '_id': 'id3',
          'name': 'Artist 3'
        }
      ];

      mf.database.getArtistFromCache.
        mockResolvedValueOnce( mockCached[ 0 ] ).
        mockResolvedValueOnce( mockCached[ 1 ] ).
        mockResolvedValueOnce( mockCached[ 2 ] );

      const result = await mf.artistService.fetchMultipleActs( [ 'id1', 'id2', 'id3' ] );

      expect( result ).toEqual( {
        'acts': mockCached
      } );
      expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ 'id2', 'id3' ] );
    } );
  } );
} );
