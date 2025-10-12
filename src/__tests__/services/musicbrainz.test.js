/**
 * Tests for MusicBrainz API client
 */

const axios = require( 'axios' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const fixtureData = require( '../fixtures/musicbrainz-jungle-rot.json' );

jest.mock( 'axios' );

describe( 'MusicBrainz API Client', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  describe( 'fetchArtist', () => {
    /**
     * Test successful artist fetch
     */
    test( 'fetches artist data successfully', async () => {
      const artistId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      axios.get.mockResolvedValue( {
        'data': fixtureData
      } );

      const result = await musicbrainzClient.fetchArtist( artistId );

      expect( axios.get ).toHaveBeenCalledWith(
        `https://musicbrainz.org/ws/2/artist/${artistId}?inc=aliases+url-rels&fmt=json`,
        expect.objectContaining( {
          'headers': expect.objectContaining( {
            'User-Agent': expect.stringContaining( 'MusicFavorites' )
          } )
        } )
      );
      expect( result ).toEqual( fixtureData );
    } );

    /**
     * Test API error handling
     */
    test( 'throws error when API request fails', async () => {
      const artistId = 'invalid-id';
      const errorMessage = 'Request failed with status code 404';

      axios.get.mockRejectedValue( new Error( errorMessage ) );

      await expect( musicbrainzClient.fetchArtist( artistId ) ).
        rejects.
        toThrow( errorMessage );
    } );

    /**
     * Test rate limiting compliance with User-Agent
     */
    test( 'includes proper User-Agent header for rate limiting', async () => {
      const artistId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      axios.get.mockResolvedValue( {
        'data': fixtureData
      } );

      await musicbrainzClient.fetchArtist( artistId );

      const callArgs = axios.get.mock.calls[ 0 ][ 1 ];
      expect( callArgs.headers[ 'User-Agent' ] ).toMatch( /MusicFavorites/u );
      expect( callArgs.headers[ 'User-Agent' ] ).toMatch( /https?:\/\//u );
    } );

    /**
     * Test network timeout handling
     */
    test( 'handles network timeout', async () => {
      const artistId = 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317';

      axios.get.mockRejectedValue( new Error( 'timeout of 10000ms exceeded' ) );

      await expect( musicbrainzClient.fetchArtist( artistId ) ).
        rejects.
        toThrow( 'timeout' );
    } );
  } );
} );
