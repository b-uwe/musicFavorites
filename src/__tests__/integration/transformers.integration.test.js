/**
 * Integration tests for transformer pipeline
 * Tests: musicbrainzTransformer → bandsintownTransformer workflow
 * Mocks: Only external I/O (HTTP for LD+JSON)
 * @module __tests__/integration/transformers.integration
 */

const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );
const fixtureBandsintownLdJson = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

// Load fixture modifier
require( '../../testHelpers/fixtureModifier' );

// Mock only external HTTP
jest.mock( '../../services/ldJsonExtractor' );

// Load modules
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );

describe( 'Transformer Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
  } );

  /**
   * Test full transformer pipeline: MusicBrainz → Bandsintown
   */
  test( 'musicbrainzTransformer output flows correctly through bandsintownTransformer', async () => {
    // Step 1: Transform MusicBrainz data
    const mbTransformed = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    // Verify MusicBrainz transformation
    expect( mbTransformed._id ).toBe( fixtureVulvodynia.id );
    expect( mbTransformed.name ).toBe( fixtureVulvodynia.name );
    expect( mbTransformed.country ).toBe( 'South Africa' );

    // Step 2: Mock LD+JSON fetch
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

    // Step 3: Get Bandsintown URL from transformed data
    const bandsintownUrl = mbTransformed.relations.bandsintown;

    expect( bandsintownUrl ).toBe( 'https://www.bandsintown.com/a/6461184' );

    // Step 4: Fetch and transform events
    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( bandsintownUrl );
    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    // Verify events were transformed
    expect( Array.isArray( events ) ).toBe( true );
    expect( events.length ).toBeGreaterThan( 0 );

    // Verify event structure
    const [ firstEvent ] = events;

    expect( firstEvent ).toHaveProperty( 'name' );
    expect( firstEvent ).toHaveProperty( 'date' );
    expect( firstEvent ).toHaveProperty( 'localTime' );
    expect( firstEvent ).toHaveProperty( 'location' );
  } );

  /**
   * Test country code expansion through transformer
   */
  test( 'country codes are expanded to full names correctly', () => {
    // South Africa
    const vulvodyniaTransformed = mf.musicbrainzTransformer.transformActData( fixtureVulvodynia );

    expect( vulvodyniaTransformed.country ).toBe( 'South Africa' );

    // United Kingdom
    const kinksTransformed = mf.musicbrainzTransformer.transformActData( fixtureTheKinks );

    expect( kinksTransformed.country ).toBe( 'United Kingdom' );
  } );

  /**
   * Test status determination with and without events
   */
  test( 'events from different dates are transformed correctly', () => {
    // Transform future events
    const futureEvents = mf.testing.fixtureModifier.normalizeDates(
      fixtureBandsintownLdJson,
      30
    );
    const transformedFutureEvents = mf.bandsintownTransformer.transformEvents( futureEvents );

    // Should have events
    expect( transformedFutureEvents.length ).toBeGreaterThan( 0 );

    // Each event should have a date
    transformedFutureEvents.forEach( ( event ) => {
      expect( event.date ).toBeDefined();
      expect( typeof event.date ).toBe( 'string' );
    } );
  } );

  /**
   * Test empty LD+JSON handling through pipeline
   */
  test( 'empty LD+JSON results in empty events array', () => {
    const emptyEvents = mf.bandsintownTransformer.transformEvents( [] );

    expect( emptyEvents ).toEqual( [] );
  } );

  /**
   * Test past events are filtered correctly
   */
  test( 'past events are filtered out during transformation', () => {
    // Create past events (365 days ago)
    const pastEvents = mf.testing.fixtureModifier.normalizeDates(
      fixtureBandsintownLdJson,
      -365
    );

    const transformed = mf.bandsintownTransformer.transformEvents( pastEvents );

    // Should filter out events older than 2 days
    expect( transformed ).toEqual( [] );
  } );

  /**
   * Test transformer handles artist without Bandsintown URL
   */
  test( 'transformed artist without Bandsintown has no bandsintown relation', () => {
    const artistWithoutBandsintown = {
      ...fixtureTheKinks,
      'relations': fixtureTheKinks.relations.filter( ( rel ) => rel.type !== 'bandsintown' )
    };

    const transformed = mf.musicbrainzTransformer.transformActData( artistWithoutBandsintown );

    expect( transformed.relations.bandsintown ).toBeUndefined();
  } );

  /**
   * Test event location data flows through transformers
   */
  test( 'event location data is correctly transformed', () => {
    const events = mf.bandsintownTransformer.transformEvents( fixtureBandsintownLdJson );

    expect( events.length ).toBeGreaterThan( 0 );

    const [ firstEvent ] = events;

    expect( firstEvent.location ).toBeDefined();
    expect( firstEvent.location.address ).toBeDefined();
    expect( firstEvent.location.geo ).toBeDefined();
    expect( firstEvent.location.geo.lat ).toBeDefined();
    expect( firstEvent.location.geo.lon ).toBeDefined();
  } );
} );
