/**
 * Database connection module tests
 * @module __tests__/services/database
 */

const { MongoClient } = require( 'mongodb' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

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

  describe( 'getArtistFromCache', () => {
    let mockCollection;
    let transformedJungleRot;

    beforeEach( () => {
      mockCollection = {
        findOne: jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedJungleRot = musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    } );

    test( 'should return artist data from cache when found', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.findOne.mockResolvedValue( transformedJungleRot );

      await database.connect();
      const result = await database.getArtistFromCache( transformedJungleRot.musicbrainzId );

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.findOne ).toHaveBeenCalledWith( {
        musicbrainzId: transformedJungleRot.musicbrainzId
      } );
      expect( result ).toEqual( transformedJungleRot );
    } );

    test( 'should return null when artist not found in cache', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      const artistId = 'nonexistent-id';
      mockCollection.findOne.mockResolvedValue( null );

      await database.connect();
      const result = await database.getArtistFromCache( artistId );

      expect( mockCollection.findOne ).toHaveBeenCalledWith( {
        musicbrainzId: artistId
      } );
      expect( result ).toBeNull();
    } );

    test( 'should throw error when not connected', async () => {
      await expect( database.getArtistFromCache( 'some-id' ) ).rejects.toThrow( 'Database not connected. Call connect() first.' );
    } );
  } );

  describe( 'cacheArtist', () => {
    let mockCollection;
    let transformedTheKinks;

    beforeEach( () => {
      mockCollection = {
        updateOne: jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedTheKinks = musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    } );

    test( 'should cache artist data', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        acknowledged: true
      } );

      await database.connect();
      await database.cacheArtist( transformedTheKinks );

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        {
          musicbrainzId: transformedTheKinks.musicbrainzId
        },
        {
          $set: transformedTheKinks
        },
        {
          upsert: true
        }
      );
    } );

    test( 'should throw error when not connected', async () => {
      const artistData = {
        musicbrainzId: 'some-id',
        name: 'Test Artist'
      };

      await expect( database.cacheArtist( artistData ) ).rejects.toThrow( 'Database not connected. Call connect() first.' );
    } );

    test( 'should throw error when artistData is missing musicbrainzId', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      await database.connect();

      const invalidArtistData = {
        name: 'Test Artist'
      };

      await expect( database.cacheArtist( invalidArtistData ) ).rejects.toThrow( 'Artist data must include musicbrainzId' );
    } );

    test( 'should throw error when write not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        acknowledged: false
      } );

      await database.connect();

      await expect( database.cacheArtist( transformedTheKinks ) ).rejects.toThrow( 'Cache write not acknowledged by database' );
    } );
  } );

  describe( 'testCacheHealth', () => {
    let mockCollection;

    beforeEach( () => {
      mockCollection = {
        updateOne: jest.fn(),
        deleteOne: jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
    } );

    test( 'should write and delete health check document', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        acknowledged: true
      } );
      mockCollection.deleteOne.mockResolvedValue( {
        acknowledged: true
      } );

      await database.connect();
      await database.testCacheHealth();

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        {
          musicbrainzId: '__health_check__'
        },
        {
          $set: {
            musicbrainzId: '__health_check__',
            name: 'Health Check',
            testEntry: true
          }
        },
        {
          upsert: true
        }
      );
      expect( mockCollection.deleteOne ).toHaveBeenCalledWith( {
        musicbrainzId: '__health_check__'
      } );
    } );

    test( 'should throw error when not connected', async () => {
      await expect( database.testCacheHealth() ).rejects.toThrow( 'Database not connected. Call connect() first.' );
    } );

    test( 'should throw error when write fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockRejectedValue( new Error( 'Write failed' ) );

      await database.connect();

      await expect( database.testCacheHealth() ).rejects.toThrow( 'Write failed' );
      expect( mockCollection.deleteOne ).not.toHaveBeenCalled();
    } );

    test( 'should throw error when write not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        acknowledged: false
      } );

      await database.connect();

      await expect( database.testCacheHealth() ).rejects.toThrow( 'Health check write not acknowledged by database' );
      expect( mockCollection.deleteOne ).not.toHaveBeenCalled();
    } );

    test( 'should throw error when delete not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        ok: 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        acknowledged: true
      } );
      mockCollection.deleteOne.mockResolvedValue( {
        acknowledged: false
      } );

      await database.connect();

      await expect( database.testCacheHealth() ).rejects.toThrow( 'Health check delete not acknowledged by database' );
    } );
  } );
} );
