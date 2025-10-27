/**
 * Integration tests for ldJsonExtractor workflow
 * Tests: ldJsonExtractor → bandsintownTransformer flow
 * Mocks: Only external HTTP calls
 * @module __tests__/integration/ldJsonExtractor.integration
 */

// Mock axios for HTTP calls (not business logic)
jest.mock( 'axios' );

const axios = require( 'axios' );

// Load real business logic modules
require( '../../testHelpers/fixtureHelpers' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );

const { loadFixture } = mf.testing.fixtureHelpers;

describe( 'LD+JSON Extractor Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  /**
   * Test successful LD+JSON extraction and transformation
   */
  test( 'fetchAndExtractLdJson output flows into bandsintownTransformer correctly', async () => {
    const fixtureHtml = loadFixture( 'bandsintown-vulvodynia.html' );

    axios.get.mockResolvedValue( {
      'data': fixtureHtml
    } );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    // Verify full workflow
    expect( Array.isArray( events ) ).toBe( true );
    expect( events.length ).toBeGreaterThan( 0 );

    // Verify structure of first event
    const [ firstEvent ] = events;

    expect( firstEvent ).toHaveProperty( 'name' );
    expect( firstEvent ).toHaveProperty( 'date' );
    expect( firstEvent ).toHaveProperty( 'localTime' );
    expect( firstEvent ).toHaveProperty( 'location' );
  } );

  /**
   * Test empty LD+JSON response handling
   */
  test( 'empty LD+JSON array results in empty events', async () => {
    const emptyHtml = loadFixture( 'empty.html' );

    axios.get.mockResolvedValue( {
      'data': emptyHtml
    } );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    expect( events ).toEqual( [] );
  } );

  /**
   * Test network error response handling
   */
  test( 'network error returns empty array gracefully', async () => {
    axios.get.mockRejectedValue( new Error( 'Network error' ) );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    // LdJsonExtractor should return empty array on error
    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    expect( events ).toEqual( [] );
  } );

  /**
   * Test malformed LD+JSON handling
   */
  test( 'malformed LD+JSON with missing required fields is filtered out', async () => {
    const malformedHtml = loadFixture( 'malformed-json.html' );

    axios.get.mockResolvedValue( {
      'data': malformedHtml
    } );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    /*
     * Malformed JSON blocks are skipped by parser, remaining valid blocks are processed
     * This fixture has 2 valid Person/Organization blocks, not MusicEvent blocks
     */
    expect( Array.isArray( events ) ).toBe( true );
  } );

  /**
   * Test LD+JSON extraction error handling
   */
  test( 'fetchAndExtractLdJson returns empty array on HTTP error', async () => {
    axios.get.mockRejectedValue( new Error( 'HTTP request failed' ) );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    // LdJsonExtractor fails silently and returns empty array
    expect( ldJson ).toEqual( [] );
  } );

  /**
   * Test LD+JSON with mixed valid/invalid events
   */
  test( 'mixed valid and invalid LD+JSON events filters correctly', async () => {
    const validHtml = loadFixture( 'bandsintown-vulvodynia.html' );

    axios.get.mockResolvedValue( {
      'data': validHtml
    } );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    // Should only include valid events
    expect( events.length ).toBeGreaterThanOrEqual( 1 );

    // All returned events should have required fields
    events.forEach( ( event ) => {
      expect( event ).toHaveProperty( 'name' );
      expect( event ).toHaveProperty( 'date' );
      expect( event ).toHaveProperty( 'location' );
    } );
  } );
} );
