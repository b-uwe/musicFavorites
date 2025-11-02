/**
 * Tests for integration test setup helpers
 * @module __tests__/testHelpers/integrationTestSetup
 */

// Mock external I/O BEFORE requiring modules

const axios = require( 'axios' );
const { MongoClient } = require( 'mongodb' );

// Set up mf.logger before loading modules
require( '../../constants' );
globalThis.mf = globalThis.mf || {};
globalThis.mf.logger = {
  'debug': jest.fn(),
  'info': jest.fn(),
  'warn': jest.fn(),
  'error': jest.fn()
};

// Load real modules
require( '../../services/database' );
require( '../../testHelpers/integrationTestSetup' );

describe( 'Integration Test Setup Helpers', () => {
  describe( 'setupMongoMocks', () => {
    test( 'creates MongoDB mock collection with standard methods', () => {
      const mockCollection = mf.testing.integrationTestSetup.setupMongoMocks();

      expect( mockCollection ).toHaveProperty( 'findOne' );
      expect( mockCollection ).toHaveProperty( 'updateOne' );
      expect( mockCollection ).toHaveProperty( 'find' );
      expect( mockCollection ).toHaveProperty( 'deleteOne' );
      expect( typeof mockCollection.findOne ).toBe( 'function' );
    } );

    test( 'configures MongoClient mock implementation', () => {
      mf.testing.integrationTestSetup.setupMongoMocks();

      const client = new MongoClient();

      expect( client ).toHaveProperty( 'connect' );
      expect( client ).toHaveProperty( 'db' );
      expect( client ).toHaveProperty( 'close' );
    } );

    test( 'MongoClient.db returns mock database with command and collection', () => {
      mf.testing.integrationTestSetup.setupMongoMocks();

      const client = new MongoClient();
      const db = client.db();

      expect( db ).toHaveProperty( 'command' );
      expect( db ).toHaveProperty( 'collection' );
    } );

    test( 'updateOne resolves with acknowledged response', async () => {
      const mockCollection = mf.testing.integrationTestSetup.setupMongoMocks();

      const result = await mockCollection.updateOne();

      expect( result ).toEqual( { 'acknowledged': true } );
    } );

    test( 'find returns toArray method that resolves empty array', async () => {
      const mockCollection = mf.testing.integrationTestSetup.setupMongoMocks();

      const cursor = mockCollection.find();
      const result = await cursor.toArray();

      expect( Array.isArray( result ) ).toBe( true );
      expect( result.length ).toBe( 0 );
    } );

    test( 'deleteOne resolves with acknowledged response', async () => {
      const mockCollection = mf.testing.integrationTestSetup.setupMongoMocks();

      const result = await mockCollection.deleteOne();

      expect( result ).toEqual( { 'acknowledged': true } );
    } );
  } );

  describe( 'setupAxiosMocks', () => {
    beforeEach( () => {
      jest.clearAllMocks();
    } );

    test( 'configures axios.get mock function', () => {
      mf.testing.integrationTestSetup.setupAxiosMocks();

      expect( axios.get ).toBeDefined();
      expect( typeof axios.get ).toBe( 'function' );
    } );

    test( 'returns MusicBrainz fixture for musicbrainz.org URLs', async () => {
      const fixture = { 'name': 'Test Fixture' };

      mf.testing.integrationTestSetup.setupAxiosMocks( fixture );

      const response = await axios.get( 'https://musicbrainz.org/artist/123' );

      expect( response.data ).toEqual( fixture );
    } );

    test( 'returns empty string for non-MusicBrainz URLs', async () => {
      mf.testing.integrationTestSetup.setupAxiosMocks();

      const response = await axios.get( 'https://example.com' );

      expect( response.data ).toBe( '' );
    } );

    test( 'uses default fixture when none provided', async () => {
      mf.testing.integrationTestSetup.setupAxiosMocks();

      const response = await axios.get( 'https://musicbrainz.org/artist/123' );

      expect( response.data ).toBeDefined();
      expect( response.data ).toHaveProperty( 'id' );
    } );
  } );

  describe( 'setupTestDatabase', () => {
    beforeEach( async () => {
      jest.clearAllMocks();

      // Disconnect database before each test
      try {
        await mf.database.disconnect();
      } catch ( error ) {
        // Ignore errors if not connected
      }

      // Setup mocks
      mf.testing.integrationTestSetup.setupMongoMocks();
    } );

    test( 'disconnects existing database connection', async () => {
      const disconnectSpy = jest.spyOn( mf.database, 'disconnect' );

      await mf.testing.integrationTestSetup.setupTestDatabase();

      expect( disconnectSpy ).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    } );

    test( 'sets MONGODB_URI environment variable', async () => {
      await mf.testing.integrationTestSetup.setupTestDatabase();

      expect( process.env.MONGODB_URI ).toBe( 'mongodb://localhost:27017/test' );
    } );

    test( 'does not throw when disconnecting unconnected database', async () => {
      // Database is already disconnected in beforeEach
      await expect( mf.testing.integrationTestSetup.setupTestDatabase() ).resolves.not.toThrow();
    } );
  } );

  describe( 'setupIntegrationTest', () => {
    beforeEach( async () => {
      jest.clearAllMocks();
      jest.useRealTimers();

      try {
        await mf.database.disconnect();
      } catch ( error ) {
        // Ignore errors if not connected
      }
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    test( 'clears all mocks', async () => {
      const mockFn = jest.fn();

      mockFn();
      await mf.testing.integrationTestSetup.setupIntegrationTest();

      expect( mockFn ).not.toHaveBeenCalled();
    } );

    test( 'returns mockCollection object', async () => {
      const result = await mf.testing.integrationTestSetup.setupIntegrationTest();

      expect( result ).toHaveProperty( 'mockCollection' );
      expect( result.mockCollection ).toHaveProperty( 'findOne' );
    } );

    test( 'enables fake timers when useFakeTimers option is true', async () => {
      await mf.testing.integrationTestSetup.setupIntegrationTest( { 'useFakeTimers': true } );

      // Test that setTimeout is mocked (indicating fake timers are active)
      const callback = jest.fn();

      setTimeout( callback, 1000 );
      expect( callback ).not.toHaveBeenCalled();

      jest.advanceTimersByTime( 1000 );
      expect( callback ).toHaveBeenCalled();
    } );

    test( 'does not enable fake timers by default', async () => {
      await mf.testing.integrationTestSetup.setupIntegrationTest();

      const startTime = Date.now();

      // Small delay to ensure time advances
      await new Promise( ( resolve ) => {
        setTimeout( resolve, 10 );
      } );
      const endTime = Date.now();

      expect( endTime ).toBeGreaterThan( startTime );
    } );

    test( 'resets fetch queue when fetchQueueTestingApi is provided', async () => {
      // Mock fetch queue functions
      const clearSpy = jest.fn();
      const setIsRunningSpy = jest.fn();

      const fetchQueueTestingApi = {
        'fetchQueue': { 'clear': clearSpy },
        'setIsRunning': setIsRunningSpy
      };

      await mf.testing.integrationTestSetup.setupIntegrationTest( { fetchQueueTestingApi } );

      expect( clearSpy ).toHaveBeenCalled();
      expect( setIsRunningSpy ).toHaveBeenCalledWith( false );
    } );

    test( 'does not reset fetch queue when not provided', async () => {
      const clearSpy = jest.fn();
      const setIsRunningSpy = jest.fn();

      // Create API but don't pass it
      clearSpy.mockName( 'clearSpy' );
      setIsRunningSpy.mockName( 'setIsRunningSpy' );

      await mf.testing.integrationTestSetup.setupIntegrationTest();

      expect( clearSpy ).not.toHaveBeenCalled();
      expect( setIsRunningSpy ).not.toHaveBeenCalled();
    } );

    test( 'uses custom fixture for axios mocks', async () => {
      const customFixture = { 'custom': 'data' };

      await mf.testing.integrationTestSetup.setupIntegrationTest( { 'fixture': customFixture } );

      const response = await axios.get( 'https://musicbrainz.org/test' );

      expect( response.data ).toEqual( customFixture );
    } );

    test( 'supports multiple options combined', async () => {
      const customFixture = { 'combined': 'test' };
      const clearSpy = jest.fn();
      const setIsRunningSpy = jest.fn();

      const fetchQueueTestingApi = {
        'fetchQueue': { 'clear': clearSpy },
        'setIsRunning': setIsRunningSpy
      };

      const result = await mf.testing.integrationTestSetup.setupIntegrationTest( {
        'useFakeTimers': true,
        fetchQueueTestingApi,
        'fixture': customFixture
      } );

      expect( result.mockCollection ).toBeDefined();
      expect( clearSpy ).toHaveBeenCalled();
      expect( setIsRunningSpy ).toHaveBeenCalledWith( false );

      // Test fake timers are active
      const callback = jest.fn();

      setTimeout( callback, 1000 );
      expect( callback ).not.toHaveBeenCalled();

      jest.advanceTimersByTime( 1000 );
      expect( callback ).toHaveBeenCalled();

      // Test custom fixture
      const response = await axios.get( 'https://musicbrainz.org/test' );

      expect( response.data ).toEqual( customFixture );
    } );
  } );

  describe( 'resetFetchQueueState', () => {
    test( 'clears fetch queue and sets isRunning to false', () => {
      const clearSpy = jest.fn();
      const setIsRunningSpy = jest.fn();

      const fetchQueueTestingApi = {
        'fetchQueue': { 'clear': clearSpy },
        'setIsRunning': setIsRunningSpy
      };

      mf.testing.integrationTestSetup.resetFetchQueueState( fetchQueueTestingApi );

      expect( clearSpy ).toHaveBeenCalled();
      expect( setIsRunningSpy ).toHaveBeenCalledWith( false );
    } );
  } );
} );
