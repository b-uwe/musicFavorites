/**
 * Tests for MusicBrainz API client
 *
 * NOTE: These tests primarily provide code coverage for the thin wrapper
 * around axios. The axios library itself is mocked, so we're not testing
 * real HTTP behavior - we're only exercising the code paths to ensure
 * 100% coverage. The real business logic (data transformation) is tested
 * thoroughly in musicbrainzTransformer.test.js.
 *
 * What's MOCKED: axios HTTP calls (no real network requests)
 * What's TESTED: Code execution paths (for coverage), error propagation
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
     * MOCKED: axios.get returns fixture data
     * TESTED: fetchArtist() execution path, returns response.data
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
     * MOCKED: axios.get throws an error
     * TESTED: fetchArtist() error propagation path
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
     * MOCKED: axios.get throws timeout error
     * TESTED: fetchArtist() timeout error propagation path
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
