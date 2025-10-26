/**
 * Integration tests for artistService core workflows
 * Tests: artistService → musicbrainzTransformer → bandsintownTransformer → ldJsonExtractor
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/artistService.integration
 */

const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownLdJson = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

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
   * Test that fetchBandsintownEvents returns empty array when no Bandsintown relation
   */
  test( 'fetchBandsintownEvents returns empty array when artist has no Bandsintown URL', async () => {
    const artistWithoutBandsintown = {
      '_id': 'test-id',
      'name': 'Test Artist',
      'relations': {}
    };

    const events = await mf.artistService.fetchBandsintownEvents(
      artistWithoutBandsintown,
      false
    );

    expect( events ).toEqual( [] );
    expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
  } );

  /**
   * Test error handling with silentFail=true
   */
  test( 'fetchBandsintownEvents returns empty array on fetch failure when silentFail=true', async () => {
    const artist = mf.musicbrainzTransformer.transformArtistData( fixtureVulvodynia );

    mf.ldJsonExtractor.fetchAndExtractLdJson.
      mockRejectedValue( new Error( 'Network error' ) );

    const events = await mf.artistService.fetchBandsintownEvents( artist, true );

    expect( events ).toEqual( [] );
    expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).toHaveBeenCalled();
  } );

  /**
   * Test error handling with silentFail=false
   */
  test( 'fetchBandsintownEvents throws error on fetch failure when silentFail=false', async () => {
    const artist = mf.musicbrainzTransformer.transformArtistData( fixtureVulvodynia );

    mf.ldJsonExtractor.fetchAndExtractLdJson.
      mockRejectedValue( new Error( 'Network error' ) );

    await expect( mf.artistService.fetchBandsintownEvents( artist, false ) ).
      rejects.toThrow( 'Network error' );
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
     * Mock LD+JSON with past events
     * Note: The fixture already has past events, but let's be explicit
     */
    const pastEventsLdJson = [
      {
        '@type': 'MusicEvent',
        'name': 'Past Concert',
        'startDate': '2020-01-01T19:00:00',
        'location': {
          'name': 'Old Venue',
          'address': {
            'streetAddress': '123 Past St',
            'addressLocality': 'Old City',
            'addressCountry': 'OC'
          },
          'geo': {
            'latitude': 1.0,
            'longitude': 1.0
          }
        }
      }
    ];

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( pastEventsLdJson );

    const events = await mf.artistService.fetchBandsintownEvents( artist, false );

    /*
     * Events older than 2 days should be filtered out
     * This tests that bandsintownTransformer.filterPastEvents is called
     */
    const hasEventsFromYear2020 = events.
      some( ( event ) => event.date && event.date.startsWith( '2020' ) );

    expect( hasEventsFromYear2020 ).toBe( false );
  } );
} );
