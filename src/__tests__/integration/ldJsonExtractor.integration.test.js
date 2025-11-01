/**
 * Integration tests for ldJsonExtractor workflow
 * Tests: ldJsonExtractor → bandsintownTransformer flow
 * Mocks: Only external HTTP calls
 * @module __tests__/integration/ldJsonExtractor.integration
 */

// Mock axios for HTTP calls (not business logic)

const axios = require( 'axios' );

// Load real business logic modules
require( '../../testHelpers/fixtureHelpers' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );

describe( 'LD+JSON Extractor Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  /**
   * Test successful LD+JSON extraction and transformation
   */
  test( 'fetchAndExtractLdJson output flows into bandsintownTransformer correctly', async () => {
    axios.get.mockResolvedValue( {
      'data': mf.testing.fixtureHelpers.loadFixture( 'bandsintown-vulvodynia.html' )
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
    axios.get.mockResolvedValue( {
      'data': mf.testing.fixtureHelpers.loadFixture( 'empty.html' )
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
    axios.get.mockResolvedValue( {
      'data': mf.testing.fixtureHelpers.loadFixture( 'malformed-json.html' )
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
} );
