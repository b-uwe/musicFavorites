/**
 * Unit tests for musicbrainz module
 * Tests HTTP client wrapper by mocking axios
 * @module __tests__/unit/services/musicbrainz
 */

// Mock axios before requiring musicbrainz
jest.mock( 'axios' );

describe( 'musicbrainz', () => {
  let musicbrainz;
  let axios;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    axios = require( 'axios' );
    musicbrainz = require( '../../../services/musicbrainz' );
  } );

  describe( 'fetchArtist', () => {
    /**
     * Test successful fetch
     */
    test( 'fetches artist data from MusicBrainz API', async () => {
      const mockData = {
        'id': 'test-id',
        'name': 'Test Artist',
        'type': 'Person'
      };

      axios.get.mockResolvedValue( {
        'data': mockData
      } );

      const result = await musicbrainz.fetchArtist( 'test-id' );

      expect( axios.get ).toHaveBeenCalledWith(
        'https://musicbrainz.org/ws/2/artist/test-id?inc=aliases+url-rels&fmt=json',
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
      axios.get.mockRejectedValue( new Error( 'Network error' ) );

      await expect( musicbrainz.fetchArtist( 'test-id' ) ).
        rejects.
        toThrow( 'MusicBrainz: Network error' );
    } );

    /**
     * Test includes correct User-Agent
     */
    test( 'includes User-Agent header in request', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      await musicbrainz.fetchArtist( 'test-id' );

      const call = axios.get.mock.calls[ 0 ];

      expect( call[ 1 ].headers[ 'User-Agent' ] ).toBeDefined();
      expect( call[ 1 ].headers[ 'User-Agent' ] ).toContain( 'musicFavorites' );
    } );

    /**
     * Test includes timeout
     */
    test( 'includes timeout in request', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      await musicbrainz.fetchArtist( 'test-id' );

      const call = axios.get.mock.calls[ 0 ];

      expect( call[ 1 ].timeout ).toBeDefined();
      expect( typeof call[ 1 ].timeout ).toBe( 'number' );
    } );

    /**
     * Test constructs correct URL
     */
    test( 'constructs correct MusicBrainz API URL', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      await musicbrainz.fetchArtist( 'abc-123' );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( 'https://musicbrainz.org/ws/2/artist/abc-123' ),
        expect.any( Object )
      );
    } );

    /**
     * Test includes correct query parameters
     */
    test( 'includes aliases and url-rels in query parameters', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      await musicbrainz.fetchArtist( 'test-id' );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( 'inc=aliases+url-rels' ),
        expect.any( Object )
      );
    } );

    /**
     * Test requests JSON format
     */
    test( 'requests JSON format', async () => {
      axios.get.mockResolvedValue( { 'data': {} } );

      await musicbrainz.fetchArtist( 'test-id' );

      expect( axios.get ).toHaveBeenCalledWith(
        expect.stringContaining( 'fmt=json' ),
        expect.any( Object )
      );
    } );
  } );
} );
