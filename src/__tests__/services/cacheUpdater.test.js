/**
 * Tests for cache updater service
 * @module __tests__/services/cacheUpdater
 */

const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

const cacheUpdater = require( '../../services/cacheUpdater' );

describe( 'Cache Updater Service', () => {
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();

    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );
  } );

  describe( 'updateAct', () => {
    /**
     * Test that updateAct fetches fresh data and replaces cache
     */
    test( 'fetches MusicBrainz data and replaces cache entry', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actId );
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          '_id': actId,
          'name': transformedTheKinks.name,
          'events': []
        } )
      );
    } );

    /**
     * Test that updateAct fetches Bandsintown events when available
     */
    test( 'fetches Bandsintown events when artist has bandsintown URL', async () => {
      const actId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownVulvodynia );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( actId );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).
        toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( database.cacheArtist ).toHaveBeenCalledWith(
        expect.objectContaining( {
          '_id': actId,
          'name': transformedVulvodynia.name,
          'events': expect.any( Array )
        } )
      );
    } );

    /**
     * Test that updateAct includes human-readable timestamp
     */
    test( 'includes human-readable updatedAt timestamp in cached data', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockResolvedValue();

      await cacheUpdater.updateAct( actId );

      expect( database.cacheArtist ).toHaveBeenCalled();
      const cachedData = database.cacheArtist.mock.calls[ 0 ][ 0 ];

      expect( cachedData ).toHaveProperty( 'updatedAt' );
      expect( typeof cachedData.updatedAt ).toBe( 'string' );
      expect( cachedData.updatedAt ).toMatch( /^\w+ \w+ \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}/ );
    } );

    /**
     * Test that updateAct skips on error without throwing
     */
    test( 'skips update on MusicBrainz error without throwing', async () => {
      const actId = 'invalid-id';

      musicbrainzClient.fetchArtist.mockRejectedValue( new Error( 'MusicBrainz error' ) );

      await expect( cacheUpdater.updateAct( actId ) ).resolves.not.toThrow();
      expect( database.cacheArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that updateAct skips on cache write error without throwing
     */
    test( 'skips update on cache write error without throwing', async () => {
      const actId = transformedTheKinks._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      await expect( cacheUpdater.updateAct( actId ) ).resolves.not.toThrow();
      expect( database.cacheArtist ).toHaveBeenCalled();
    } );
  } );
} );
