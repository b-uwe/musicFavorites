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
