/**
 * Tests for artist service with transparent caching
 * @module __tests__/services/actService
 */

const actService = require( '../../services/actService' );
const database = require( '../../services/database' );
const fixtureModifier = require( '../../testHelpers/fixtureModifier' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownVulvodynia = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

const { determineStatus } = actService;

describe( 'Act Service', () => {
  let transformedJungleRot;
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedJungleRot = musicbrainzTransformer.transformActData( fixtureJungleRot );
    transformedTheKinks = musicbrainzTransformer.transformActData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformActData( fixtureVulvodynia );
  } );

  describe( 'determineStatus - unit tests', () => {
    /**
     * Test line 53: all events have invalid dates in transformed format
     */
    test( 'returns MusicBrainz status when all transformed events have invalid dates', () => {
      const eventsWithInvalidDates = [
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

      const result = determineStatus( eventsWithInvalidDates, 'active' );

      expect( result ).toBe( 'active' );
    } );
  } );

  describe( 'fetchBandintownEvents - unit tests', () => {
    /**
     * Test that silentFail undefined uses default (false) and throws error
     */
    test( 'throws error when Bandsintown fetch fails and silentFail is undefined', async () => {
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( actService.fetchBandsintownEvents( transformedVulvodynia ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );

    /**
     * Test that silentFail set to true fails silently
     */
    test( 'does NOT throw when Bandsintown fetch fails and silentFail is true', async () => {
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await actService.fetchBandsintownEvents( transformedVulvodynia, true );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'fetchAndEnrichActData - direct tests', () => {
    /**
     * Test that silentEventFail=true returns empty events on Bandsintown error
     */
    test( 'returns empty events when Bandsintown fetch fails and silentEventFail=true', async () => {
      const artistId = transformedVulvodynia._id;

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await actService.fetchAndEnrichActData( artistId, true );

      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
      expect( result ).toHaveProperty( 'events' );
      expect( result.events ).toEqual( [] );
      expect( result ).toHaveProperty( 'updatedAt' );
      expect( result ).toHaveProperty( 'status' );
    } );

    /**
     * Test that silentEventFail undefined uses default (false) and throws error
     */
    test( 'throws error when Bandsintown fetch fails and silentEventFail=undefined', async () => {
      const artistId = transformedVulvodynia._id;

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( actService.fetchAndEnrichActData( artistId ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );
  } );
} );
