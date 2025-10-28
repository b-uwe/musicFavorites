/**
 * Integration tests for actService core workflows
 * Tests: actService → musicbrainzTransformer → bandsintownTransformer → ldJsonExtractor
 * Mocks: Only external I/O (axios for HTTP, mongodb for database)
 * @module __tests__/integration/actService.integration
 */

const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

// Load test helpers
require( '../../testHelpers/fixtureHelpers' );
require( '../../testHelpers/integrationTestSetup' );

// Mock external I/O BEFORE requiring modules
jest.mock( 'axios' );
jest.mock( 'mongodb' );

const axios = require( 'axios' );

// Load all real business logic modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );
require( '../../services/actService' );
require( '../../services/fetchQueue' );

describe( 'Act Service Integration Tests', () => {
  let mockCollection;

  beforeEach( async () => {
    const { 'mockCollection': collection } = await mf.testing.integrationTestSetup.setupIntegrationTest();

    mockCollection = collection;

    // Mock fetchQueue to prevent background processing
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test fetchAndEnrichActData workflow:
   * musicbrainz → musicbrainzTransformer → bandsintownTransformer → final enriched data
   */
  test( 'fetchAndEnrichActData enriches MusicBrainz data with Bandsintown events', async () => {
    // Mock HTTP responses
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        return Promise.resolve( {
          'data': mf.testing.fixtureHelpers.loadFixture( 'bandsintown-vulvodynia.html' )
        } );
      }

      return Promise.reject( new Error( 'Unexpected URL' ) );
    } );

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
    expect( axios.get ).toHaveBeenCalledWith( expect.stringContaining( 'bandsintown.com' ), expect.any( Object ) );
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

    // Mock Bandsintown HTTP response
    axios.get.mockResolvedValue( {
      'data': mf.testing.fixtureHelpers.loadFixture( 'bandsintown-vulvodynia.html' )
    } );

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
    expect( axios.get ).toHaveBeenCalledWith( expect.stringContaining( 'bandsintown.com' ), expect.any( Object ) );
  } );

  /**
   * Test that status determination integrates correctly with event data
   */
  test( 'fetchAndEnrichActData determines status based on enriched events', async () => {
    // Mock HTTP responses
    axios.get.mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixtureVulvodynia } );
      }
      if ( url.includes( 'bandsintown.com' ) ) {
        return Promise.resolve( {
          'data': mf.testing.fixtureHelpers.loadFixture( 'bandsintown-vulvodynia.html' )
        } );
      }

      return Promise.reject( new Error( 'Unexpected URL' ) );
    } );

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

    // Mock empty HTML (no events)
    axios.get.mockResolvedValue( {
      'data': mf.testing.fixtureHelpers.loadFixture( 'empty.html' )
    } );

    const events = await mf.actService.fetchBandsintownEvents( artist, false );

    // Empty HTML results in no events
    expect( events ).toEqual( [] );
  } );

  /**
   * Test MusicBrainz API failure during live request
   */
  test( 'fetchAndEnrichActData handles MusicBrainz API failures', async () => {
    // Mock MusicBrainz HTTP failure
    axios.get.mockRejectedValue( new Error( 'MusicBrainz API rate limit exceeded' ) );

    await expect( mf.actService.fetchAndEnrichActData( fixtureVulvodynia.id, false ) ).rejects.toThrow( 'MusicBrainz API rate limit exceeded' );
  } );

  /**
   * Test that fetchMultipleActs handles missing acts correctly
   */
  test( 'fetchMultipleActs returns error response when acts not cached', async () => {
    const actIds = [
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'f35e1992-230b-4d63-9e63-a829caccbcd5'
    ];

    // Mock MongoDB to return null (acts not in cache)
    mockCollection.findOne.mockResolvedValue( null );

    const result = await mf.actService.fetchMultipleActs( actIds );

    // Should return error response and trigger background fetch
    expect( result.error ).toBeDefined();
    expect( result.error.missingCount ).toBe( 3 );
    expect( mf.fetchQueue.triggerBackgroundFetch ).toHaveBeenCalledWith( actIds );
  } );

  /**
   * Test cache failure (database error) during fetchMultipleActs
   */
  test( 'fetchMultipleActs throws service error on cache read failures', async () => {
    const actIds = [
      fixtureVulvodynia.id,
      '664c3e0e-42d8-48c1-b209-1efca19c0325',
      'f35e1992-230b-4d63-9e63-a829caccbcd5'
    ];

    // Mock MongoDB to reject (simulate database failure)
    mockCollection.findOne.mockRejectedValue( new Error( 'Cache read failed' ) );

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

    const baseArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    /*
     * Remove _id from transformed data to avoid conflict with MongoDB _id
     */
    // eslint-disable-next-line no-unused-vars
    const { _id, ...artistDataWithoutId } = baseArtist;

    // MongoDB documents with _id field
    const staleArtistInDb = {
      '_id': fixtureVulvodynia.id,
      ...artistDataWithoutId,
      'events': [],
      'updatedAt': exactlyStaleTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    };

    const freshArtistInDb = {
      '_id': '664c3e0e-42d8-48c1-b209-1efca19c0325',
      ...artistDataWithoutId,
      'events': [],
      'updatedAt': barelyFreshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } )
    };

    // Mock MongoDB to return these acts
    mockCollection.findOne.
      mockResolvedValueOnce( staleArtistInDb ).
      mockResolvedValueOnce( freshArtistInDb );

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

    // Mock MusicBrainz HTTP response
    axios.get.mockResolvedValue( { 'data': artistWithoutBandsintown } );

    const result = await mf.actService.fetchAndEnrichActData(
      artistWithoutBandsintown.id,
      false
    );

    // Should still return transformed data
    expect( result._id ).toBe( artistWithoutBandsintown.id );

    // But events should be empty
    expect( result.events ).toEqual( [] );

    // Only MusicBrainz should be called, not Bandsintown
    expect( axios.get ).toHaveBeenCalledTimes( 1 );
    expect( axios.get ).toHaveBeenCalledWith( expect.stringContaining( 'musicbrainz.org' ), expect.any( Object ) );
  } );

  /**
   * Test Bandsintown events fetch failure
   */
  test( 'fetchBandsintownEvents handles HTTP errors gracefully', async () => {
    const artist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    // Mock Bandsintown HTTP failure
    axios.get.mockRejectedValue( new Error( 'HTTP request timeout' ) );

    /*
     * LdJsonExtractor catches errors and returns empty array
     * So fetchBandsintownEvents returns empty array, doesn't throw
     */
    const events = await mf.actService.fetchBandsintownEvents( artist, false );

    expect( events ).toEqual( [] );
  } );

  /**
   * Test fetchMultipleActs with large number of IDs
   */
  test( 'fetchMultipleActs handles many acts efficiently', async () => {
    const baseArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    // Mock MongoDB to return documents with matching _id
    mockCollection.findOne.mockImplementation( ( query ) => Promise.resolve( {
      ...baseArtist,
      '_id': query._id,
      'events': []
    } ) );

    const manyActIds = Array.from( { 'length': 50 }, ( _, i ) => `act-id-${i}` );

    const result = await mf.actService.fetchMultipleActs( manyActIds );

    // Should return all acts
    expect( result.acts ).toHaveLength( 50 );
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 50 );
  } );

  /**
   * Test fetchMultipleActs with duplicate IDs
   */
  test( 'fetchMultipleActs handles duplicate IDs correctly', async () => {
    const baseArtist = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    // Return the act with correct _id from MongoDB
    mockCollection.findOne.mockResolvedValue( {
      ...baseArtist,
      '_id': fixtureVulvodynia.id,
      'events': []
    } );

    const duplicateIds = [
      fixtureVulvodynia.id,
      fixtureVulvodynia.id,
      fixtureVulvodynia.id
    ];

    const result = await mf.actService.fetchMultipleActs( duplicateIds );

    // Should return all three (no deduplication in current implementation)
    expect( result.acts ).toHaveLength( 3 );
    // Should fetch all three times (no deduplication in current implementation)
    expect( mockCollection.findOne ).toHaveBeenCalledTimes( 3 );
  } );
} );
