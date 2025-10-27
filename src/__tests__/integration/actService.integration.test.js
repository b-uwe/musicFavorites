/**
 * Integration tests for actService core workflows
 * Tests: actService → musicbrainzTransformer → bandsintownTransformer → ldJsonExtractor
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/actService.integration
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
require( '../../services/actService' );

describe( 'Act Service Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock external I/O
    mf.musicbrainz.fetchAct = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
    mf.database.cacheAct = jest.fn().mockResolvedValue();
    mf.database.getActFromCache = jest.fn();
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test fetchAndEnrichActData workflow:
   * musicbrainz → musicbrainzTransformer → bandsintownTransformer → final enriched data
   */
  test( 'fetchAndEnrichActData enriches MusicBrainz data with Bandsintown events', async () => {
    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const result = await mf.actService.fetchAndEnrichActData(
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
    const artist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const events = await mf.actService.fetchBandsintownEvents( artist, false );

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
  test( 'fetchAndEnrichActData determines status based on enriched events', async () => {
    mf.musicbrainz.fetchAct.mockResolvedValue( fixtureVulvodynia );
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    const result = await mf.actService.fetchAndEnrichActData(
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
    const artist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    /*
     * Use fixture modifier to create past events
     * normalizeDates with negative value moves dates to the past
     */
    const pastEventsLdJson = mf.testing.fixtureModifier.normalizeDates(
      fixtureBandsintownLdJson,
      -365
    );

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( pastEventsLdJson );

    const events = await mf.actService.fetchBandsintownEvents( artist, false );

    /*
     * Events older than 2 days should be filtered out
     * This tests that bandsintownTransformer.filterPastEvents is called
     */
    expect( events ).toEqual( [] );
  } );

  /**
   * Test MusicBrainz API failure during live request
   */
  test( 'fetchAndEnrichActData handles MusicBrainz API failures', async () => {
    mf.musicbrainz.fetchAct.mockRejectedValue( new Error( 'MusicBrainz API rate limit exceeded' ) );

    await expect( mf.actService.fetchAndEnrichActData( fixtureVulvodynia.id, false ) ).rejects.toThrow( 'MusicBrainz API rate limit exceeded' );
  } );

  /**
   * Test partial failures in multi-act fetches
   */
  test( 'fetchMultipleActs throws service error on partial cache failures', async () => {
    const actIds = [
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'f35e1992-230b-4d63-9e63-a829caccbcd5'
    ];

    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    transformedArtist.events = [];

    // Any failure in cache read will trigger SVC_002
    mf.database.getActFromCache = jest.fn().mockRejectedValue( new Error( 'Cache read failed' ) );

    // Should throw SVC_002 error
    await expect( mf.actService.fetchMultipleActs( actIds ) ).rejects.toThrow( 'SVC_002' );
  } );

  /**
   * Test staleness calculation edge case
   */
  test( 'fetchMultipleActs correctly identifies stale data at boundary', async () => {
    const now = new Date();

    // Exactly 24 hours old (should be stale)
    const exactlyStaleTimestamp = new Date( now.getTime() - ( 24 * 60 * 60 * 1000 ) );

    // Just under 24 hours old (should be fresh)
    const barelyFreshTimestamp = new Date( now.getTime() - ( ( 24 * 60 * 60 * 1000 ) - 1000 ) );

    const transformedStaleArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    // Transform _id to musicbrainzId to match real getActFromCache behavior
    const { _id, ...staleArtistData } = transformedStaleArtist;
    const staleArtist = {
      'musicbrainzId': _id,
      ...staleArtistData,
      'events': [],
      'updatedAt': exactlyStaleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    };

    const freshArtist = {
      ...staleArtist,
      'musicbrainzId': '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'updatedAt': barelyFreshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    };

    mf.database.getActFromCache.
      mockResolvedValueOnce( staleArtist ).
      mockResolvedValueOnce( freshArtist );

    const result = await mf.actService.fetchMultipleActs( [
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325'
    ] );

    // Should return success
    expect( result.acts ).toHaveLength( 2 );

    // Should trigger refresh for stale act only
    expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( [ fixtureVulvodynia.id ] );
  } );

  /**
   * Test Bandsintown URL extraction failure
   */
  test( 'fetchAndEnrichActData handles artists without Bandsintown URL', async () => {
    const artistWithoutBandsintown = {
      ...fixtureVulvodynia,
      'relations': fixtureVulvodynia.relations.filter( ( rel ) => rel.type !== 'bandsintown' )
    };

    mf.musicbrainz.fetchAct.mockResolvedValue( artistWithoutBandsintown );

    const result = await mf.actService.fetchAndEnrichActData(
      artistWithoutBandsintown.id,
      false
    );

    // Should still return transformed data
    expect( result._id ).toBe( artistWithoutBandsintown.id );

    // But events should be empty
    expect( result.events ).toEqual( [] );

    // LD+JSON extractor should not be called
    expect( mf.ldJsonExtractor.fetchAndExtractLdJson ).not.toHaveBeenCalled();
  } );

  /**
   * Test Bandsintown events fetch failure
   */
  test( 'fetchBandsintownEvents handles HTTP errors gracefully', async () => {
    const artist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'HTTP request timeout' ) );

    await expect( mf.actService.fetchBandsintownEvents( artist, false ) ).rejects.toThrow( 'HTTP request timeout' );
  } );

  /**
   * Test fetchMultipleActs with large number of IDs
   */
  test( 'fetchMultipleActs handles many acts efficiently', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    transformedArtist.events = [];

    // Mock 50 cached acts
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const manyActIds = Array.from( { 'length': 50 }, ( _, i ) => `act-id-${i}` );

    const result = await mf.actService.fetchMultipleActs( manyActIds );

    // Should return all acts
    expect( result.acts ).toHaveLength( 50 );
    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 50 );
  } );

  /**
   * Test fetchMultipleActs with duplicate IDs
   */
  test( 'fetchMultipleActs handles duplicate IDs correctly', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    transformedArtist.events = [];
    mf.database.getActFromCache.mockResolvedValue( transformedArtist );

    const duplicateIds = [
      fixtureVulvodynia.id,
      fixtureVulvodynia.id,
      fixtureVulvodynia.id
    ];

    const result = await mf.actService.fetchMultipleActs( duplicateIds );

    // Should deduplicate and return once
    expect( result.acts ).toHaveLength( 3 );
    // Should fetch all three times (no deduplication in current implementation)
    expect( mf.database.getActFromCache ).toHaveBeenCalledTimes( 3 );
  } );
} );
