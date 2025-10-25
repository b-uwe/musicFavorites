/**
 * Database connection module tests
 * @module __tests__/services/database
 */

require( '../../services/musicbrainzTransformer' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

// Mock MongoClient
jest.mock( 'mongodb', () => ( {
  'MongoClient': jest.fn(),
  'ServerApiVersion': {
    'v1': 'v1'
  }
} ) );


describe( 'Database Service', () => {
  let mockClient;
  let mockDb;

  beforeEach( () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Clear the module from cache to reset its internal state
    jest.resetModules();

    // Re-mock mongodb after reset
    jest.doMock( 'mongodb', () => ( {
      'MongoClient': jest.fn(),
      'ServerApiVersion': {
        'v1': 'v1'
      }
    } ) );

    // Create mock database object
    mockDb = {
      'command': jest.fn()
    };

    // Create mock client object
    mockClient = {
      'connect': jest.fn(),
      'db': jest.fn( () => mockDb ),
      'close': jest.fn()
    };

    // Get the mocked MongoClient
    const { 'MongoClient': MockedMongoClient } = require( 'mongodb' );

    // Mock MongoClient constructor
    MockedMongoClient.mockImplementation( () => mockClient );

    // Re-require the database module with fresh state AFTER mocking (sets up mf.database)
    require( '../../services/database' );

    // Set test environment variable
    process.env.MONGODB_URI = 'mongodb+srv://test:password@test.mongodb.net/?retryWrites=true&w=majority';
  } );

  describe( 'connect', () => {
    test( 'should connect to MongoDB successfully', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      await mf.database.connect();

      // Get the mocked MongoClient for assertion
      const { 'MongoClient': MockedMongoClient } = require( 'mongodb' );

      expect( MockedMongoClient ).toHaveBeenCalledWith(
        process.env.MONGODB_URI,
        expect.objectContaining( {
          'serverApi': expect.objectContaining( {
            'version': 'v1',
            'strict': true,
            'deprecationErrors': true
          } )
        } )
      );
      expect( mockClient.connect ).toHaveBeenCalled();
      expect( mockDb.command ).toHaveBeenCalledWith( {
        'ping': 1
      } );
    } );

    test( 'should throw error when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;

      await expect( mf.database.connect() ).rejects.toThrow( 'Service misconfigured. Please try again later. (Error: DB_001)' );
    } );

    test( 'should throw error when connection fails', async () => {
      const error = new Error( 'Connection failed' );
      mockClient.connect.mockRejectedValue( error );

      await expect( mf.database.connect() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_011)' );
    } );

    test( 'should not reconnect if already connected', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      await mf.database.connect();
      await mf.database.connect();

      expect( mockClient.connect ).toHaveBeenCalledTimes( 1 );
    } );

    test( 'should throw error when ping verification fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 0
      } );

      await expect( mf.database.connect() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_002)' );
    } );

    test( 'should reset client on ping failure to allow retry', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValueOnce( {
        'ok': 0
      } );

      // First attempt fails
      await expect( mf.database.connect() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_002)' );

      // Set up successful connection for retry
      mockDb.command.mockResolvedValueOnce( {
        'ok': 1
      } );

      // Second attempt should succeed (not blocked by failed client)
      await expect( mf.database.connect() ).resolves.not.toThrow();
      expect( mockClient.connect ).toHaveBeenCalledTimes( 2 );
    } );

    test( 'should reset client on connection failure to allow retry', async () => {
      const error = new Error( 'Connection failed' );
      mockClient.connect.mockRejectedValueOnce( error );

      // First attempt fails
      await expect( mf.database.connect() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_011)' );

      // Set up successful connection for retry
      mockClient.connect.mockResolvedValueOnce( mockClient );
      mockDb.command.mockResolvedValueOnce( {
        'ok': 1
      } );

      // Second attempt should succeed (not blocked by failed client)
      await expect( mf.database.connect() ).resolves.not.toThrow();
      expect( mockClient.connect ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'disconnect', () => {
    test( 'should disconnect from MongoDB successfully', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );
      mockClient.close.mockResolvedValue();

      await mf.database.connect();
      await mf.database.disconnect();

      expect( mockClient.close ).toHaveBeenCalled();
    } );

    test( 'should not throw error when disconnecting without connection', async () => {
      await expect( mf.database.disconnect() ).resolves.not.toThrow();
    } );

    test( 'should throw error when close fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );
      const closeError = new Error( 'Close failed' );
      mockClient.close.mockRejectedValue( closeError );

      await mf.database.connect();

      await expect( mf.database.disconnect() ).rejects.toThrow( 'Service temporarily unavailable during disconnection. (Error: DB_012)' );
    } );

    test( 'should keep client reference when close fails to allow retry', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );
      const closeError = new Error( 'Close failed' );
      mockClient.close.mockRejectedValueOnce( closeError );

      await mf.database.connect();

      // First disconnect attempt fails
      await expect( mf.database.disconnect() ).rejects.toThrow( 'Service temporarily unavailable during disconnection. (Error: DB_012)' );

      // Set up successful close for retry
      mockClient.close.mockResolvedValueOnce();

      // Second attempt should succeed (client reference was kept)
      await expect( mf.database.disconnect() ).resolves.not.toThrow();
      expect( mockClient.close ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'getDatabase', () => {
    test( 'should return database instance', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      await mf.database.connect();
      const db = mf.testing.database.getDatabase( 'musicfavorites' );

      expect( mockClient.db ).toHaveBeenCalledWith( 'musicfavorites' );
      expect( db ).toBe( mockDb );
    } );

    test( 'should throw error when not connected', () => {
      expect( () => mf.testing.database.getDatabase( 'musicfavorites' ) ).toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_003)' );
    } );
  } );

  describe( 'getArtistFromCache', () => {
    let mockCollection;
    let transformedJungleRot;

    beforeEach( () => {
      mockCollection = {
        'findOne': jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedJungleRot = mf.musicbrainzTransformer.transformArtistData( fixtureJungleRot );
    } );

    test( 'should return artist data from cache when found', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.findOne.mockResolvedValue( transformedJungleRot );

      await mf.database.connect();
      const result = await mf.database.getArtistFromCache( transformedJungleRot._id );

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.findOne ).toHaveBeenCalledWith( {
        '_id': transformedJungleRot._id
      } );

      // Result should have musicbrainzId (not _id) and all other fields
      expect( result.musicbrainzId ).toBe( transformedJungleRot._id );
      expect( result._id ).toBeUndefined();
      expect( result.name ).toBe( transformedJungleRot.name );
      expect( result.country ).toBe( transformedJungleRot.country );
    } );

    test( 'should return null when artist not found in cache', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const artistId = 'nonexistent-id';
      mockCollection.findOne.mockResolvedValue( null );

      await mf.database.connect();
      const result = await mf.database.getArtistFromCache( artistId );

      expect( mockCollection.findOne ).toHaveBeenCalledWith( {
        '_id': artistId
      } );
      expect( result ).toBeNull();
    } );

    test( 'should throw error when not connected', async () => {
      await expect( mf.database.getArtistFromCache( 'some-id' ) ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_004)' );
    } );
  } );

  describe( 'cacheArtist', () => {
    let mockCollection;
    let transformedTheKinks;

    beforeEach( () => {
      mockCollection = {
        'updateOne': jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedTheKinks = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    } );

    test( 'should cache artist data', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': true
      } );

      await mf.database.connect();
      await mf.database.cacheArtist( transformedTheKinks );

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        {
          '_id': transformedTheKinks._id
        },
        {
          '$set': transformedTheKinks
        },
        {
          'upsert': true
        }
      );
    } );

    test( 'should throw error when not connected', async () => {
      const artistData = {
        '_id': 'some-id',
        'name': 'Test Artist'
      };

      await expect( mf.database.cacheArtist( artistData ) ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_005)' );
    } );

    test( 'should throw error when artistData is missing _id', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      await mf.database.connect();

      const invalidArtistData = {
        'name': 'Test Artist'
      };

      await expect( mf.database.cacheArtist( invalidArtistData ) ).rejects.toThrow( 'Invalid request. Please try again later. (Error: DB_006)' );
    } );

    test( 'should throw error when write not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': false
      } );

      await mf.database.connect();

      await expect( mf.database.cacheArtist( transformedTheKinks ) ).rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_007)' );
    } );
  } );

  describe( 'testCacheHealth', () => {
    let mockCollection;

    beforeEach( () => {
      mockCollection = {
        'updateOne': jest.fn(),
        'deleteOne': jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
    } );

    test( 'should write and delete health check document', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': true
      } );
      mockCollection.deleteOne.mockResolvedValue( {
        'acknowledged': true
      } );

      await mf.database.connect();
      await mf.database.testCacheHealth();

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        {
          '_id': '__health_check__'
        },
        {
          '$set': {
            '_id': '__health_check__',
            'name': 'Health Check',
            'testEntry': true
          }
        },
        {
          'upsert': true
        }
      );
      expect( mockCollection.deleteOne ).toHaveBeenCalledWith( {
        '_id': '__health_check__'
      } );
    } );

    test( 'should throw error when not connected', async () => {
      await expect( mf.database.testCacheHealth() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_008)' );
    } );

    test( 'should throw error when write fails', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockRejectedValue( new Error( 'Write failed' ) );

      await mf.database.connect();

      await expect( mf.database.testCacheHealth() ).rejects.toThrow( 'Write failed' );
      expect( mockCollection.deleteOne ).not.toHaveBeenCalled();
    } );

    test( 'should throw error when write not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': false
      } );

      await mf.database.connect();

      await expect( mf.database.testCacheHealth() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_009)' );
      expect( mockCollection.deleteOne ).not.toHaveBeenCalled();
    } );

    test( 'should throw error when delete not acknowledged', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': true
      } );
      mockCollection.deleteOne.mockResolvedValue( {
        'acknowledged': false
      } );

      await mf.database.connect();

      await expect( mf.database.testCacheHealth() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_010)' );
    } );
  } );

  describe( 'getAllActIds', () => {
    let mockCollection;
    let transformedJungleRot;
    let transformedTheKinks;

    beforeEach( () => {
      mockCollection = {
        'find': jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedJungleRot = mf.musicbrainzTransformer.transformArtistData( fixtureJungleRot );
      transformedTheKinks = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    } );

    /**
     * Test that getAllActIds returns sorted array of _id values
     */
    test( 'should return sorted array of all cached act IDs', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': transformedTheKinks._id
          },
          {
            '_id': transformedJungleRot._id
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActIds();

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.find ).toHaveBeenCalledWith(
        {},
        {
          'projection': {
            '_id': 1
          }
        }
      );

      expect( Array.isArray( result ) ).toBe( true );
      expect( result ).toHaveLength( 2 );
      expect( result ).toEqual( [
        transformedJungleRot._id,
        transformedTheKinks._id
      ].sort() );
    } );

    /**
     * Test that getAllActIds returns empty array when cache is empty
     */
    test( 'should return empty array when no acts in cache', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActIds();

      expect( result ).toEqual( [] );
    } );

    /**
     * Test that getAllActIds throws error when not connected
     */
    test( 'should throw error when not connected', async () => {
      await expect( mf.database.getAllActIds() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_013)' );
    } );
  } );

  describe( 'getAllActsWithMetadata', () => {
    let mockCollection;
    let transformedJungleRot;
    let transformedTheKinks;

    beforeEach( () => {
      mockCollection = {
        'find': jest.fn()
      };
      mockDb.collection = jest.fn( () => mockCollection );
      transformedJungleRot = mf.musicbrainzTransformer.transformArtistData( fixtureJungleRot );
      transformedTheKinks = mf.musicbrainzTransformer.transformArtistData( fixtureTheKinks );
    } );

    /**
     * Test that getAllActsWithMetadata returns sorted array with _id and updatedAt
     */
    test( 'should return sorted array of acts with _id and updatedAt', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      // Return in reverse order (JungleRot before TheKinks) to test sort function
      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': transformedJungleRot._id,
            'updatedAt': '2025-01-02 12:00:00'
          },
          {
            '_id': transformedTheKinks._id,
            'updatedAt': '2025-01-01 12:00:00'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActsWithMetadata();

      expect( mockDb.collection ).toHaveBeenCalledWith( 'artists' );
      expect( mockCollection.find ).toHaveBeenCalledWith(
        {},
        {
          'projection': {
            '_id': 1,
            'updatedAt': 1
          }
        }
      );

      expect( Array.isArray( result ) ).toBe( true );
      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ] ).toHaveProperty( '_id' );
      expect( result[ 0 ] ).toHaveProperty( 'updatedAt' );

      // Verify results are sorted by _id (TheKinks 53... < JungleRot ab...)
      expect( result[ 0 ]._id ).toBe( transformedTheKinks._id );
      expect( result[ 1 ]._id ).toBe( transformedJungleRot._id );
    } );

    /**
     * Test that getAllActsWithMetadata correctly sorts acts with equal IDs
     * NOTE: This tests the return 0 branch in the sort comparator (line 256 of database.js).
     * In production, MongoDB _id fields are unique per document, so equal IDs should never occur.
     */
    test( 'should handle sorting when IDs are equal', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const sameId = 'same-id-for-testing';

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': sameId,
            'updatedAt': '2025-01-01 12:00:00'
          },
          {
            '_id': sameId,
            'updatedAt': '2025-01-02 12:00:00'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActsWithMetadata();

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ]._id ).toBe( sameId );
      expect( result[ 1 ]._id ).toBe( sameId );
    } );

    /**
     * Test that getAllActsWithMetadata handles missing updatedAt fields
     */
    test( 'should handle acts with missing updatedAt field', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': transformedTheKinks._id
          },
          {
            '_id': transformedJungleRot._id,
            'updatedAt': '2025-01-02 12:00:00'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActsWithMetadata();

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ].updatedAt ).toBeUndefined();
      expect( result[ 1 ].updatedAt ).toBe( '2025-01-02 12:00:00' );
    } );

    /**
     * Test that getAllActsWithMetadata returns empty array when cache is empty
     */
    test( 'should return empty array when no acts in cache', async () => {
      mockClient.connect.mockResolvedValue( mockClient );
      mockDb.command.mockResolvedValue( {
        'ok': 1
      } );

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      await mf.database.connect();
      const result = await mf.database.getAllActsWithMetadata();

      expect( result ).toEqual( [] );
    } );

    /**
     * Test that getAllActsWithMetadata throws error when not connected
     */
    test( 'should throw error when not connected', async () => {
      await expect( mf.database.getAllActsWithMetadata() ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_014)' );
    } );
  } );
} );
