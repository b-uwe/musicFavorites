/**
 * Database connection module tests
 * @module __tests__/services/database
 */

const { MongoClient } = require( 'mongodb' );

// Mock MongoClient
jest.mock( 'mongodb', () => ( {
  MongoClient: jest.fn(),
  ServerApiVersion: {
    v1: 'v1'
  }
} ) );

describe( 'Database Service', () => {
  let mockClient;
  let mockDb;
  let database;

  beforeEach( () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Clear the module from cache to reset its internal state
    jest.resetModules();

    // Re-mock mongodb after reset
    jest.doMock( 'mongodb', () => ( {
      MongoClient: jest.fn(),
      ServerApiVersion: {
        v1: 'v1'
      }
    } ) );

    // Create mock database object
    mockDb = {
      command: jest.fn()
    };

    // Create mock client object
    mockClient = {
      connect: jest.fn(),
      db: jest.fn( () => mockDb ),
      close: jest.fn()
    };

    // Get the mocked MongoClient
    const { MongoClient: MockedMongoClient } = require( 'mongodb' );

    // Mock MongoClient constructor
    MockedMongoClient.mockImplementation( () => mockClient );

    // Re-require the database module with fresh state AFTER mocking
    database = require( '../../services/database' );

    // Set test environment variable
    process.env.MONGODB_URI = 'mongodb+srv://test:password@test.mongodb.net/?retryWrites=true&w=majority';
  } );

  describe( 'connect', () => {
    test( 'should connect to MongoDB successfully', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      await database.connect();

      // Get the mocked MongoClient for assertion
      const { MongoClient: MockedMongoClient } = require( 'mongodb' );

      expect( MockedMongoClient ).toHaveBeenCalledWith(
        process.env.MONGODB_URI,
        expect.objectContaining( {
          serverApi: expect.objectContaining( {
            version: 'v1',
            strict: true,
            deprecationErrors: true
          } )
        } )
      );
      expect( mockClient.connect ).toHaveBeenCalled();
      expect( mockDb.command ).toHaveBeenCalledWith( {
        ping: 1
      } );
    } );

    test( 'should throw error when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;

      await expect( database.connect() ).rejects.toThrow( 'MONGODB_URI environment variable is not set' );
    } );

    test( 'should throw error when connection fails', async () => {
      const error = new Error( 'Connection failed' );
      mockClient.connect.mockRejectedValue( error );

      await expect( database.connect() ).rejects.toThrow( 'Connection failed' );
    } );

    test( 'should not reconnect if already connected', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      await database.connect();
      await database.connect();

      expect( mockClient.connect ).toHaveBeenCalledTimes( 1 );
    } );

    test( 'should throw error when ping verification fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 0
      } );

      await expect( database.connect() ).rejects.toThrow( 'MongoDB ping verification failed' );
    } );

    test( 'should reset client on ping failure to allow retry', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValueOnce( {
        ok: 0
      } );

      // First attempt fails
      await expect( database.connect() ).rejects.toThrow( 'MongoDB ping verification failed' );

      // Set up successful connection for retry
      mockDb.command.mockResolvedValueOnce( {
        ok: 1
      } );

      // Second attempt should succeed (not blocked by failed client)
      await expect( database.connect() ).resolves.not.toThrow();
      expect( mockClient.connect ).toHaveBeenCalledTimes( 2 );
    } );

    test( 'should reset client on connection failure to allow retry', async () => {
      const error = new Error( 'Connection failed' );
      mockClient.connect.mockRejectedValueOnce( error );

      // First attempt fails
      await expect( database.connect() ).rejects.toThrow( 'Connection failed' );

      // Set up successful connection for retry
      mockClient.connect.mockResolvedValueOnce( mockClient );
      mockDb.command.mockResolvedValueOnce( {
        ok: 1
      } );

      // Second attempt should succeed (not blocked by failed client)
      await expect( database.connect() ).resolves.not.toThrow();
      expect( mockClient.connect ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'disconnect', () => {
    test( 'should disconnect from MongoDB successfully', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );
      mockClient.close.mockResolvedValue();

      await database.connect();
      await database.disconnect();

      expect( mockClient.close ).toHaveBeenCalled();
    } );

    test( 'should not throw error when disconnecting without connection', async () => {
      await expect( database.disconnect() ).resolves.not.toThrow();
    } );

    test( 'should throw error when close fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );
      const closeError = new Error( 'Close failed' );
      mockClient.close.mockRejectedValue( closeError );

      await database.connect();

      await expect( database.disconnect() ).rejects.toThrow( 'Close failed' );
    } );

    test( 'should keep client reference when close fails to allow retry', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );
      const closeError = new Error( 'Close failed' );
      mockClient.close.mockRejectedValueOnce( closeError );

      await database.connect();

      // First disconnect attempt fails
      await expect( database.disconnect() ).rejects.toThrow( 'Close failed' );

      // Set up successful close for retry
      mockClient.close.mockResolvedValueOnce();

      // Second attempt should succeed (client reference was kept)
      await expect( database.disconnect() ).resolves.not.toThrow();
      expect( mockClient.close ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'getDatabase', () => {
    test( 'should return database instance', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      await database.connect();
      const db = database.getDatabase( 'musicfavorites' );

      expect( mockClient.db ).toHaveBeenCalledWith( 'musicfavorites' );
      expect( db ).toBe( mockDb );
    } );

    test( 'should throw error when not connected', () => {
      expect( () => database.getDatabase( 'musicfavorites' ) ).toThrow( 'Database not connected. Call connect() first.' );
    } );
  } );
} );
