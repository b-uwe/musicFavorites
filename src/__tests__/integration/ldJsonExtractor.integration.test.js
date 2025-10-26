/**
 * Integration tests for ldJsonExtractor workflow
 * Tests: ldJsonExtractor → bandsintownTransformer flow
 * Mocks: Only external HTTP calls
 * @module __tests__/integration/ldJsonExtractor.integration
 */

const fixtureBandsintownLdJson = require( '../fixtures/ldjson/bandsintown-vulvodynia.json' );

// Mock only external HTTP
jest.mock( '../../services/ldJsonExtractor' );

// Load modules
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/bandsintownTransformer' );

describe( 'LD+JSON Extractor Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn();
  } );

  /**
   * Test successful LD+JSON extraction and transformation
   */
  test( 'fetchAndExtractLdJson output flows into bandsintownTransformer correctly', async () => {
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( fixtureBandsintownLdJson );

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
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    expect( events ).toEqual( [] );
  } );

  /**
   * Test null LD+JSON response handling
   */
  test( 'null LD+JSON response is handled gracefully', async () => {
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( null );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    // BandsintownTransformer should handle null input
    const events = mf.bandsintownTransformer.transformEvents( ldJson || [] );

    expect( events ).toEqual( [] );
  } );

  /**
   * Test malformed LD+JSON handling
   */
  test( 'malformed LD+JSON with missing required fields is filtered out', async () => {
    const malformedLdJson = [
      {
        '@type': 'MusicEvent'
        // Missing required fields like name, startDate, location
      },
      fixtureBandsintownLdJson[ 0 ]
    ];

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( malformedLdJson );

    const ldJson = await mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' );

    const events = mf.bandsintownTransformer.transformEvents( ldJson );

    // Should only include the valid event
    expect( events.length ).toBe( 1 );
  } );

  /**
   * Test LD+JSON extraction error handling
   */
  test( 'fetchAndExtractLdJson errors are propagated correctly', async () => {
    mf.ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'HTTP request failed' ) );

    await expect( mf.ldJsonExtractor.fetchAndExtractLdJson( 'https://www.bandsintown.com/a/6461184' ) ).rejects.toThrow( 'HTTP request failed' );
  } );

  /**
   * Test LD+JSON with mixed valid/invalid events
   */
  test( 'mixed valid and invalid LD+JSON events filters correctly', async () => {
    const mixedLdJson = [
      fixtureBandsintownLdJson[ 0 ],
      {
        '@type': 'MusicEvent',
        'name': 'Invalid Event'
        // Missing required fields
      },
      fixtureBandsintownLdJson[ 1 ] || fixtureBandsintownLdJson[ 0 ]
    ];

    mf.ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( mixedLdJson );

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
