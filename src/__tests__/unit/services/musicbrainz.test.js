/**
 * Unit tests for musicbrainz module
 * Tests HTTP client wrapper by mocking axios
 * @module __tests__/unit/services/musicbrainz
 */

// Mock axios before requiring musicbrainz
jest.mock( 'axios' );

describe( 'musicbrainz', () => {
  let axios;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    axios = require( 'axios' );
    require( '../../../services/musicbrainz' );
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
  } );
} );
