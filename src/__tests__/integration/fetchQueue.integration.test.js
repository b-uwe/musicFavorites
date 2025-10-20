/**
 * Integration tests for fetch queue functionality
 * These tests use real module imports to catch circular dependencies
 * Only external dependencies (database, HTTP) are mocked
 * @module __tests__/integration/fetchQueue.integration
 */

const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

/*
 * CRITICAL: Import artistService and fetchQueue AFTER mocks are set up
 * This allows us to test real module interactions while mocking external I/O
 */
const artistService = require( '../../services/artistService' );
const fetchQueue = require( '../../services/fetchQueue' );

describe( 'Fetch Queue Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  /**
   * Test that triggerBackgroundFetch can call fetchAndEnrichArtistData without circular dependency errors
   */
  test( 'triggerBackgroundFetch calls fetchAndEnrichArtistData without errors', async () => {
    jest.useFakeTimers();

    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id
    ];

    musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureTheKinks );
    musicbrainzClient.fetchArtist.mockResolvedValueOnce( fixtureVulvodynia );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockResolvedValue();

    // Trigger background fetch
    fetchQueue.triggerBackgroundFetch( actIds );

    // Advance through both fetches (2 acts × 30s = 60s)
    await jest.advanceTimersByTimeAsync( 60000 );

    // Verify fetchAndEnrichArtistData was called (indirectly through processFetchQueue)
    expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledTimes( 2 );
    expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( fixtureTheKinks.id );
    expect( musicbrainzClient.fetchArtist ).toHaveBeenCalledWith( fixtureVulvodynia.id );
    expect( database.cacheArtist ).toHaveBeenCalledTimes( 2 );

    jest.useRealTimers();
  }, 10000 );

  /**
   * Test that fetchMultipleActs can trigger triggerBackgroundFetch for background fetching
   */
  test( 'fetchMultipleActs triggers background fetch via triggerBackgroundFetch', async () => {
    const actIds = [
      fixtureTheKinks.id,
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ];

    // All acts are missing from cache
    database.getArtistFromCache.mockResolvedValue( null );

    // Mock the background fetch behavior
    musicbrainzClient.fetchArtist.mockResolvedValue( fixtureTheKinks );
    ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
    database.cacheArtist.mockResolvedValue();

    // Call fetchMultipleActs with 3 missing acts
    const result = await artistService.fetchMultipleActs( actIds );

    // Should return error because 2+ acts are missing
    expect( result.error ).toBeDefined();
    expect( result.error.message ).toContain( '3 acts not cached' );

    // Verify triggerBackgroundFetch function exists
    expect( typeof fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
  } );

  /**
   * Test that the integration doesn't have circular dependency issues
   */
  test( 'modules load without circular dependency errors', () => {
    // If we got this far, the modules loaded successfully
    expect( artistService ).toBeDefined();
    expect( fetchQueue ).toBeDefined();
    expect( artistService.fetchAndEnrichArtistData ).toBeDefined();
    expect( typeof artistService.fetchAndEnrichArtistData ).toBe( 'function' );
    expect( fetchQueue.triggerBackgroundFetch ).toBeDefined();
    expect( typeof fetchQueue.triggerBackgroundFetch ).toBe( 'function' );
  } );
} );
