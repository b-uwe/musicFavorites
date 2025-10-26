/**
 * Integration tests for artistService core workflows
 * Tests: artistService → musicbrainzTransformer → bandsintownTransformer → ldJsonExtractor
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/artistService.integration
 */

const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownLdJson = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

// Load fixture modifier for test data manipulation
require( '../../testHelpers/fixtureModifier' );

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load all modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );
require( '../../services/artistService' );

describe( 'Artist Service Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock external I/O
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();
  } );

  /**
   * Test fetchAndEnrichArtistData workflow:
   * musicbrainz → musicbrainzTransformer → bandsintownTransformer → final enriched data
   */
  test( 'fetchAndEnrichArtistData enriches MusicBrainz data with Bandsintown events', async () => {
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const result = await mf.artistService.fetchAndEnrichArtistData(
      fixtureVulvodynia.id,
      false
    );

    // Verify MusicBrainz transformation
    expect( result._id ).toBe( fixtureVulvodynia.id );
    expect( result.name ).toBe( fixtureVulvodynia.name );
    // Transformer expands "ZA" to full name
    expect( result.country ).toBe( 'South Africa' );

    // Verify Bandsintown events were fetched and transformed
    expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalled();
    expect( result.events ).toBeDefined();
    expect( Array.isArray( result.events ) ).toBe( true );

    // Verify status determination based on events
    expect( result.status ).toBeDefined();
    expect( typeof result.status ).toBe( 'string' );

    // Verify timestamp
    expect( result.updatedAt ).toBeDefined();
    expect( result.updatedAt ).toMatch( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u );
  } );

  /**
   * Test fetchBandsintownEvents integration with transformers
   */
  test( 'fetchBandsintownEvents fetches and transforms events through full workflow', async () => {
    const artist = mf.musicbrainzTransformer.transformArtistData( fixtureVulvodynia );

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const events = await mf.artistService.fetchBandsintownEvents( artist, false );

    // Verify events were transformed
    expect( Array.isArray( events ) ).toBe( true );
    expect( events.length ).toBeGreaterThan( 0 );

    // Verify event structure matches schema
    const [ firstEvent ] = events;

    expect( firstEvent ).toHaveProperty( 'name' );
    expect( firstEvent ).toHaveProperty( 'date' );
    expect( firstEvent ).toHaveProperty( 'localTime' );
    expect( firstEvent ).toHaveProperty( 'location' );
    expect( firstEvent.location ).toHaveProperty( 'address' );
    expect( firstEvent.location ).toHaveProperty( 'geo' );

    // Verify Bandsintown URL was called
    expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).
      toHaveBeenCalledWith( expect.stringContaining( 'bandsintown.com' ) );
  } );

  /**
   * Test that status determination integrates correctly with event data
   */
  test( 'fetchAndEnrichArtistData determines status based on enriched events', async () => {
    mf.musicbrainz.fetchArtist.mockResolvedValue( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const result = await mf.artistService.fetchAndEnrichArtistData(
      fixtureVulvodynia.id,
      false
    );

    /*
     * Status should be determined by the presence and timing of events
     * This tests that determineStatus integrates correctly with the event data
     */
    expect( [ 'on tour', 'tour planned', 'disbanded', 'active', 'ended' ] ).
      toContain( result.status );
  } );

  /**
   * Test that past events are filtered out during transformation
   */
  test( 'fetchBandsintownEvents filters out past events during transformation', async () => {
    const artist = mf.musicbrainzTransformer.transformArtistData( fixtureVulvodynia );

    /*
     * Use fixture modifier to create past events
     * normalizeDates with negative value moves dates to the past
     */
    const pastEventsLdJson = mf.testing.fixtureModifier.normalizeDates(
      fixtureBandsintownLdJson,
      -365
    );

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( pastEventsLdJson );

    const events = await mf.artistService.fetchBandsintownEvents( artist, false );

    /*
     * Events older than 2 days should be filtered out
     * This tests that bandsintownTransformer.filterPastEvents is called
     */
    expect( events ).toEqual( [] );
  } );
} );
