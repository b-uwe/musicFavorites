/**
 * Unit tests for musicbrainz module
 * Tests HTTP client wrapper by mocking axios
 * @module __tests__/unit/services/musicbrainz
 */

// Mock axios before requiring musicbrainz
jest.mock( 'axios' );

describe( 'musicbrainz', () => {
  let axios;
  let debugSpy;
  let infoSpy;
  let errorSpy;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    axios = require( 'axios' );

    // Load the module (which loads logger automatically)
    require( '../../../services/musicbrainz' );

    // Spy on logger methods after module is loaded
    if ( mf.logger ) {
      debugSpy = jest.spyOn( mf.logger, 'debug' ).mockImplementation( () => {
        // Mock implementation
      } );
      infoSpy = jest.spyOn( mf.logger, 'info' ).mockImplementation( () => {
        // Mock implementation
      } );
      errorSpy = jest.spyOn( mf.logger, 'error' ).mockImplementation( () => {
        // Mock implementation
      } );
    }
  } );

  afterEach( () => {
    if ( debugSpy ) {
      debugSpy.mockRestore();
    }
    if ( infoSpy ) {
      infoSpy.mockRestore();
    }
    if ( errorSpy ) {
      errorSpy.mockRestore();
    }
  } );

  describe( 'fetchAct', () => {
    /**
     * Test successful fetch
     */
    test( 'fetches act data from MusicBrainz API', async () => {
      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';
      const mockData = {
        'id': validMbid,
        'name': 'Test Artist',
        'type': 'Person'
      };

      axios.get.mockResolvedValue( {
        'data': mockData
      } );

      const result = await mf.musicbrainz.fetchAct( validMbid );

      expect( axios.get ).toHaveBeenCalledWith(
        `https://musicbrainz.org/ws/2/artist/${validMbid}?inc=aliases+url-rels&fmt=json`,
        {
          'headers': {
            'User-Agent': expect.any( String )
          },
          'timeout': expect.any( Number )
        }
      );
      expect( result ).toEqual( mockData );
    } );

    /**
     * Test error handling
     */
    test( 'throws error with MusicBrainz prefix on failure', async () => {
      const validMbid = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';

      axios.get.mockRejectedValue( new Error( 'Network error' ) );

      await expect( mf.musicbrainz.fetchAct( validMbid ) ).
        rejects.
        toThrow( 'MusicBrainz: Network error' );
    } );

    /**
     * Test includes correct User-Agent
     */
    test( 'includes User-Agent header in request', async () => {
      const validMbid = '00000000-0000-0000-0000-000000000000';

      axios.get.mockResolvedValue( { 'data': {} } );

      await mf.musicbrainz.fetchAct( validMbid );

      const [ call ] = axios.get.mock.calls;

      expect( call[ 1 ].headers[ 'User-Agent' ] ).toBeDefined();
      expect( call[ 1 ].headers[ 'User-Agent' ] ).toContain( 'musicFavorites' );
    } );

    /**
     * Test includes timeout
     */
    test( 'includes timeout in request', async () => {
      const validMbid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

      axios.get.mockResolvedValue( { 'data': {} } );

      await mf.musicbrainz.fetchAct( validMbid );

      const [ call ] = axios.get.mock.calls;

      expect( call[ 1 ].timeout ).toBeDefined();
      expect( typeof call[ 1 ].timeout ).toBe( 'number' );
    } );

    /**
     * Test constructs correct URL
     */
    test( 'constructs correct MusicBrainz API URL', async () => {
      const validMbid = 'abc00000-0000-0000-0000-000000000123';

      axios.get.mockResolvedValue( { 'data': {} } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( `https://musicbrainz.org/ws/2/artist/${validMbid}` ),
        expect.any( Object )
      );
    } );

    /**
     * Test includes correct query parameters
     */
    test( 'includes aliases and url-rels in query parameters', async () => {
      const validMbid = '11111111-1111-1111-1111-111111111111';

      axios.get.mockResolvedValue( { 'data': {} } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( 'inc=aliases+url-rels' ),
        expect.any( Object )
      );
    } );

    /**
     * Test requests JSON format
     */
    test( 'requests JSON format', async () => {
      const validMbid = '22222222-2222-2222-2222-222222222222';

      axios.get.mockResolvedValue( { 'data': {} } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( 'fmt=json' ),
        expect.any( Object )
      );
    } );

    /**
     * Test validates MBID format
     */
    test( 'throws error for invalid MBID format', async () => {
      await expect( mf.musicbrainz.fetchAct( 'invalid-mbid' ) ).
        rejects.
        toThrow( 'MusicBrainz: Invalid MBID format' );

      expect( axios.get ).not.toHaveBeenCalled();
    } );

    /**
     * Test validates MBID is not empty
     */
    test( 'throws error for empty MBID', async () => {
      await expect( mf.musicbrainz.fetchAct( '' ) ).
        rejects.
        toThrow( 'MusicBrainz: Invalid MBID format' );

      expect( axios.get ).not.toHaveBeenCalled();
    } );

    /**
     * Test validates MBID is a string
     */
    test( 'throws error for non-string MBID', async () => {
      await expect( mf.musicbrainz.fetchAct( 123 ) ).
        rejects.
        toThrow( 'MusicBrainz: Invalid MBID format' );

      expect( axios.get ).not.toHaveBeenCalled();
    } );

    /**
     * Test accepts valid MBID format
     */
    test( 'accepts valid MBID format', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';

      await mf.musicbrainz.fetchAct( validMbid );

      expect( axios.get ).toHaveBeenCalled();
    } );

    /**
     * Test logs before fetching from MusicBrainz
     */
    test( 'logs debug message before API call', async () => {
      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';

      axios.get.mockResolvedValue( {
        'data': {
          'id': validMbid,
          'name': 'Test Artist'
        }
      } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( debugSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'actId': validMbid,
          'url': expect.stringContaining( 'musicbrainz.org' )
        } ),
        'Fetching from MusicBrainz'
      );
    } );

    /**
     * Test logs at info level after successful fetch
     */
    test( 'logs at info level after successful fetch', async () => {
      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';
      const mockData = {
        'id': validMbid,
        'name': 'Test Artist'
      };

      axios.get.mockResolvedValue( {
        'data': mockData,
        'status': 200
      } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( infoSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'actId': validMbid,
          'status': 200
        } ),
        'MusicBrainz fetch completed'
      );
    } );

    /**
     * Test logs error on API failure
     */
    test( 'logs error message on API failure', async () => {
      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';

      axios.get.mockRejectedValue( new Error( 'Network timeout' ) );

      await expect( mf.musicbrainz.fetchAct( validMbid ) ).rejects.toThrow();

      expect( errorSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'actId': validMbid,
          'error': 'Network timeout'
        } ),
        'MusicBrainz API error'
      );
    } );

    /**
     * Test logs at info level in non-test environment
     */
    test( 'logs at info level when NODE_ENV is not test', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      jest.clearAllMocks();
      jest.resetModules();

      const freshAxios = require( 'axios' );

      require( '../../../logger' );

      const freshInfoSpy = jest.spyOn( mf.logger, 'info' );

      require( '../../../services/musicbrainz' );

      const validMbid = '53689c08-f234-4c47-9256-58c8568f06d1';

      freshAxios.get.mockResolvedValue( {
        'data': { 'id': validMbid },
        'status': 200
      } );

      await mf.musicbrainz.fetchAct( validMbid );

      expect( freshInfoSpy ).toHaveBeenCalled();

      freshInfoSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    } );
  } );
} );
