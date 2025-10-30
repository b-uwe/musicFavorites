( () => {
  'use strict';

  /**
   * Test utilities for setting up integration tests
   * Provides helpers to configure mocks and test environment consistently
   * @module testHelpers/integrationTestSetup
   */

  const fixtureTheKinks = require( '../__tests__/fixtures/musicbrainz-the-kinks.json' );

  const axios = require( 'axios' );
  const { MongoClient } = require( 'mongodb' );

  /**
   * Sets up MongoDB mock collection and client
   * @returns {object} Mock collection object with standard methods
   */
  const setupMongoMocks = () => {
    const mockCollection = {
      'findOne': jest.fn(),
      'updateOne': jest.fn().mockResolvedValue( { 'acknowledged': true } ),
      'find': jest.fn().mockReturnValue( { 'toArray': jest.fn().mockResolvedValue( [] ) } ),
      'deleteOne': jest.fn().mockResolvedValue( { 'acknowledged': true } )
    };

    MongoClient.mockImplementation( () => ( {
      'connect': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( {
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } ),
        'collection': jest.fn().mockReturnValue( mockCollection )
      } ),
      'close': jest.fn().mockResolvedValue()
    } ) );

    return mockCollection;
  };

  /**
   * Sets up axios mock for HTTP calls
   * @param {object} fixture - Fixture data to return for MusicBrainz URLs (default: The Kinks)
   * @returns {void}
   */
  const setupAxiosMocks = ( fixture = fixtureTheKinks ) => {
    axios.get = jest.fn().mockImplementation( ( url ) => {
      if ( url.includes( 'musicbrainz.org' ) ) {
        return Promise.resolve( { 'data': fixture } );
      }

      return Promise.resolve( { 'data': '' } );
    } );
  };

  /**
   * Sets up test database connection with mocks
   * Disconnects existing connection and establishes fresh test connection
   * @returns {Promise<void>} Resolves when database is connected
   */
  const setupTestDatabase = async () => {
    // Disconnect database to force fresh connection with new mocks
    try {
      await mf.database.disconnect();
    } catch ( error ) {
      // Ignore errors if not connected
    }

    // Connect database before each test
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await mf.database.connect();
  };

  /**
   * Generates a timestamp in Berlin format that's always recent
   * Useful for tests that need dynamic dates within a specific time window
   * @param {number} daysAgo - How many days ago (default 1)
   * @returns {string} Berlin timestamp string in format YYYY-MM-DD HH:MM:SS+01:00
   */
  const getRecentBerlinTimestamp = ( daysAgo = 1 ) => {
    const date = new Date();

    date.setDate( date.getDate() - daysAgo );

    const dateStr = date.toLocaleString( 'sv-SE', { 'timeZone': 'Europe/Berlin' } );

    return `${dateStr.replace( ' ', ' ' )}+01:00`;
  };

  /**
   * Resets fetch queue state to initial conditions
   * @param {object} fetchQueueTestingApi - The mf.testing.fetchQueue object
   * @returns {void}
   */
  const resetFetchQueueState = ( fetchQueueTestingApi ) => {
    fetchQueueTestingApi.fetchQueue.clear();
    fetchQueueTestingApi.setIsRunning( false );
  };

  /**
   * Complete integration test setup with all mocks and configuration
   * @param {object} options - Configuration options
   * @param {boolean} options.useFakeTimers - Enable jest fake timers (default: false)
   * @param {object} options.fetchQueueTestingApi - Fetch queue testing API for reset
   * @param {object} options.fixture - Custom fixture for axios mocks (default: The Kinks)
   * @returns {Promise<object>} Object containing mockCollection
   */
  const setupIntegrationTest = async ( options = {} ) => {
    const {
      useFakeTimers = false,
      fetchQueueTestingApi = null,
      fixture = fixtureTheKinks
    } = options;

    jest.clearAllMocks();

    if ( useFakeTimers ) {
      jest.useFakeTimers();
    }

    if ( fetchQueueTestingApi ) {
      resetFetchQueueState( fetchQueueTestingApi );
    }

    const mockCollection = setupMongoMocks();

    setupAxiosMocks( fixture );
    await setupTestDatabase();

    return { mockCollection };
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.testing = globalThis.mf.testing || {};
  globalThis.mf.testing.integrationTestSetup = {
    setupMongoMocks,
    setupAxiosMocks,
    setupTestDatabase,
    setupIntegrationTest,
    resetFetchQueueState,
    getRecentBerlinTimestamp
  };
} )();
