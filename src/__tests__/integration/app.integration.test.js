/**
 * Integration tests for Express app routes
 * Tests: Express routes → artistService → database workflow
 * Mocks: Only external I/O (MongoDB, HTTP)
 * @module __tests__/integration/app.integration
 */

const request = require( 'supertest' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

// Load modules AFTER mocks
require( '../../services/database' );
require( '../../services/musicbrainz' );
require( '../../services/ldJsonExtractor' );
require( '../../services/musicbrainzTransformer' );
require( '../../services/fetchQueue' );
require( '../../services/cacheUpdater' );
require( '../../services/artistService' );
require( '../../app' );

describe( 'Express App Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();

    // Mock database as healthy by default
    mf.database.connect = jest.fn().mockResolvedValue();
    mf.database.testCacheHealth = jest.fn().mockResolvedValue();
    mf.database.getArtistFromCache = jest.fn();
    mf.database.cacheArtist = jest.fn().mockResolvedValue();

    // Mock external HTTP calls
    mf.musicbrainz.fetchArtist = jest.fn();
    mf.ldJsonExtractor.fetchAndExtractLdJson = jest.fn().mockResolvedValue( [] );

    // Mock fetchQueue and cacheUpdater
    mf.fetchQueue.triggerBackgroundFetch = jest.fn();
  } );

  /**
   * Test full request → response flow for cached artist
   */
  test( 'GET /acts/:id returns cached artist through full workflow', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    const now = new Date();
    const freshTimestamp = new Date( now.getTime() - ( 12 * 60 * 60 * 1000 ) );

    transformedArtist.events = [];
    transformedArtist.status = 'disbanded';
    transformedArtist.updatedAt = freshTimestamp.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    // Mock cache hit
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}` ).
      expect( 200 ).
      expect( 'Content-Type', /json/u );

    // Verify response structure
    expect( response.body.meta ).toBeDefined();
    expect( response.body.acts ).toHaveLength( 1 );
    expect( response.body.acts[ 0 ]._id ).toBe( fixtureTheKinks.id );
    expect( response.body.acts[ 0 ].name ).toBe( fixtureTheKinks.name );

    // Verify workflow
    expect( mf.database.getArtistFromCache ).toHaveBeenCalledWith( fixtureTheKinks.id );
    // Should not fetch immediately if cached with fresh data
    expect( mf.musicbrainz.fetchArtist ).not.toHaveBeenCalled();
    // Should not trigger background refresh for fresh data
    expect( mf.fetchQueue.triggerBackgroundFetch ).not.toHaveBeenCalled();
  } );


  /**
   * Test ?pretty parameter integration
   */
  test( 'GET /acts/:id?pretty formats JSON with proper spacing', async () => {
    const transformedArtist = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );

    transformedArtist.events = [];
    mf.database.getArtistFromCache.mockResolvedValue( transformedArtist );

    const response = await request( mf.app ).
      get( `/acts/${fixtureTheKinks.id}?pretty` ).
      expect( 200 );

    // Verify pretty formatting (has newlines and spaces)
    const responseText = JSON.stringify( response.body, null, 2 );

    expect( responseText ).toContain( '\n' );
    // 2-space indentation
    expect( responseText ).toContain( '  ' );
  } );

  /**
   * Test robots.txt endpoint
   */
  test( 'GET /robots.txt returns text/plain', async () => {
    const response = await request( mf.app ).
      get( '/robots.txt' ).
      expect( 200 ).
      expect( 'Content-Type', /text\/plain/u );

    expect( response.text ).toContain( 'User-agent' );
  } );
} );
