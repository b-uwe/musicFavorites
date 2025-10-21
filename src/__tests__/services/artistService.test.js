/**
 * Tests for artist service with transparent caching
 * @module __tests__/services/artistService
 */

const artistService = require( '../../services/artistService' );
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

const { determineStatus } = artistService;

describe( 'Artist Service', () => {
  let transformedJungleRot;
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformArtistData( fixtureVulvodynia );
  } );

  describe( 'fetchMultipleActs - cache health circuit breaker', () => {
    /**
     * Test that cache health check prevents API calls when cache is down
     */
    test( 'throws SVC_001 error when cache is unhealthy and testCacheHealth fails', async () => {
      const actIds = [ transformedTheKinks._id ];

      // Simulate cache write failure in a previous request (flagged unhealthy)
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      // First call - cache write fails, flags unhealthy
      await artistService.fetchMultipleActs( actIds );

      // Wait for async cache write to fail
      await new Promise( ( resolve ) => {
        setImmediate( resolve );
      } );

      jest.clearAllMocks();

      // Second call - should test cache health first
      database.testCacheHealth.mockRejectedValue( new Error( 'Cache still down' ) );

      await expect( artistService.fetchMultipleActs( actIds ) ).
        rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: SVC_001)' );

      // Should NOT have called getArtistFromCache or fetchArtist
      expect( database.getArtistFromCache ).not.toHaveBeenCalled();
      expect( musicbrainzClient.fetchArtist ).not.toHaveBeenCalled();
    } );

    /**
     * Test that cache recovers automatically when health check passes
     */
    test( 'recovers automatically when cache comes back online', async () => {
      const actIds = [ transformedTheKinks._id ];

      // Simulate cache write failure (flagged unhealthy)
      database.getArtistFromCache.mockResolvedValue( null );
      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheArtist.mockRejectedValue( new Error( 'Cache write failed' ) );

      await artistService.fetchMultipleActs( actIds );

      // Wait for async cache write to fail
      await new Promise( ( resolve ) => {
        setImmediate( resolve );
      } );

      jest.clearAllMocks();

      // Second call - cache health recovers
      database.testCacheHealth.mockResolvedValue();
      database.getArtistFromCache.mockResolvedValue( {
        'musicbrainzId': transformedTheKinks._id,
        'name': 'The Kinks'
      } );

      const result = await artistService.fetchMultipleActs( actIds );

      // Should have tested health and then proceeded normally
      expect( database.testCacheHealth ).toHaveBeenCalled();
      expect( database.getArtistFromCache ).toHaveBeenCalled();
      expect( result.acts ).toBeDefined();
      expect( result.acts ).toHaveLength( 1 );
    } );

    /**
     * Test that cache health is only checked when flagged unhealthy
     */
    test( 'does not test cache health when cache is healthy', async () => {
      const actIds = [ transformedTheKinks._id ];

      database.getArtistFromCache.mockResolvedValue( {
        'musicbrainzId': transformedTheKinks._id,
        'name': 'The Kinks'
      } );

      await artistService.fetchMultipleActs( actIds );

      // Should NOT have called testCacheHealth
      expect( database.testCacheHealth ).not.toHaveBeenCalled();
      expect( database.getArtistFromCache ).toHaveBeenCalled();
    } );
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

      await expect( artistService.fetchBandsintownEvents( transformedVulvodynia ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );

    /**
     * Test that silentFail set to true fails silently
     */
    test( 'does NOT throw when Bandsintown fetch fails and silentFail is true', async () => {
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await artistService.fetchBandsintownEvents( transformedVulvodynia, true );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'fetchAndEnrichArtistData - direct tests', () => {
    /**
     * Test that silentEventFail=true returns empty events on Bandsintown error
     */
    test( 'returns empty events when Bandsintown fetch fails and silentEventFail=true', async () => {
      const artistId = transformedVulvodynia._id;

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      const result = await artistService.fetchAndEnrichArtistData( artistId, true );

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

      musicbrainzClient.fetchArtist.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Network error' ) );

      await expect( artistService.fetchAndEnrichArtistData( artistId ) ).rejects.toThrow( 'Network error' );
      expect( ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalledWith( 'https://www.bandsintown.com/a/6461184' );
    } );
  } );
} );
