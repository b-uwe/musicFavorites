/**
 * Unit tests for database module error logging functions
 * Tests error logging and retrieval functionality
 * @module __tests__/unit/services/databaseErrors
 */

// Mock mongodb before requiring database
jest.mock( 'mongodb' );

// Load test helpers
require( '../../../testHelpers/integrationTestSetup' );

describe( 'database - Error Logging Tests', () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let MongoClient;

  const { getRecentBerlinTimestamp } = mf.testing.integrationTestSetup;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create mock collection
    mockCollection = {
      'findOne': jest.fn(),
      'updateOne': jest.fn(),
      'deleteOne': jest.fn(),
      'find': jest.fn(),
      'insertOne': jest.fn(),
      'createIndex': jest.fn()
    };

    // Create mock database
    mockDb = {
      'collection': jest.fn().mockReturnValue( mockCollection ),
      'command': jest.fn()
    };

    // Create mock client
    mockClient = {
      'connect': jest.fn().mockResolvedValue(),
      'close': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( mockDb )
    };

    // Mock MongoClient constructor
    const mongodb = require( 'mongodb' );

    MongoClient = jest.fn().mockImplementation( () => mockClient );
    mongodb.MongoClient = MongoClient;

    // Require database module AFTER mocking (sets up mf.database)
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  describe( 'logUpdateError', () => {
    /**
     * Test throws DB_016 error when not connected
     */
    test( 'throws DB_016 error when client is null', async () => {
      await expect( mf.database.logUpdateError( {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz'
      } ) ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_016)' );
    } );

    /**
     * Test throws DB_017 when missing required fields
     */
    test( 'throws DB_017 error when timestamp is missing', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await expect( mf.database.logUpdateError( {
        'actId': 'test-id',
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz'
      } ) ).
        rejects.
        toThrow( 'Invalid request. Please try again later. (Error: DB_017)' );
    } );

    /**
     * Test throws DB_017 when actId is missing
     */
    test( 'throws DB_017 error when actId is missing', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await expect( mf.database.logUpdateError( {
        'timestamp': getRecentBerlinTimestamp(),
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz'
      } ) ).
        rejects.
        toThrow( 'Invalid request. Please try again later. (Error: DB_017)' );
    } );

    /**
     * Test throws DB_017 when errorMessage is missing
     */
    test( 'throws DB_017 error when errorMessage is missing', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await expect( mf.database.logUpdateError( {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorSource': 'musicbrainz'
      } ) ).
        rejects.
        toThrow( 'Invalid request. Please try again later. (Error: DB_017)' );
    } );

    /**
     * Test throws DB_017 when errorSource is missing
     */
    test( 'throws DB_017 error when errorSource is missing', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await expect( mf.database.logUpdateError( {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorMessage': 'Test error'
      } ) ).
        rejects.
        toThrow( 'Invalid request. Please try again later. (Error: DB_017)' );
    } );

    /**
     * Test successfully logs error with all required fields
     */
    test( 'successfully logs error with all required fields', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.insertOne = jest.fn().mockResolvedValue( { 'acknowledged': true } );

      const errorData = {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz'
      };

      await mf.database.logUpdateError( errorData );

      expect( mockDb.collection ).toHaveBeenCalledWith( 'dataUpdateErrors' );
      expect( mockCollection.insertOne ).toHaveBeenCalledWith( expect.objectContaining( {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz',
        'createdAt': expect.any( Date )
      } ) );
    } );

    /**
     * Test throws DB_018 when write not acknowledged
     */
    test( 'throws DB_018 error when write not acknowledged', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.insertOne = jest.fn().mockResolvedValue( { 'acknowledged': false } );

      await expect( mf.database.logUpdateError( {
        'timestamp': getRecentBerlinTimestamp(),
        'actId': 'test-id',
        'errorMessage': 'Test error',
        'errorSource': 'musicbrainz'
      } ) ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_018)' );
    } );
  } );

  describe( 'getRecentUpdateErrors', () => {
    /**
     * Test throws DB_019 error when not connected
     */
    test( 'throws DB_019 error when client is null', async () => {
      await expect( mf.database.getRecentUpdateErrors() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_019)' );
    } );

    /**
     * Test returns errors from last 7 days
     */
    test( 'returns errors from last 7 days sorted by timestamp descending', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'sort': jest.fn().mockReturnThis(),
        'toArray': jest.fn().mockResolvedValue( [
          {
            'timestamp': getRecentBerlinTimestamp( 1 ),
            'actId': 'id1',
            'errorMessage': 'Error 1',
            'errorSource': 'musicbrainz'
          },
          {
            'timestamp': getRecentBerlinTimestamp( 2 ),
            'actId': 'id2',
            'errorMessage': 'Error 2',
            'errorSource': 'bandsintown'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getRecentUpdateErrors();

      expect( mockCollection.find ).toHaveBeenCalledWith(
        {
          'createdAt': { '$gte': expect.any( Date ) }
        },
        {
          'projection': {
            '_id': 0,
            'timestamp': 1,
            'actId': 1,
            'errorMessage': 1,
            'errorSource': 1
          }
        }
      );
      expect( mockCursor.sort ).toHaveBeenCalledWith( { 'createdAt': -1 } );
      expect( result ).toHaveLength( 2 );
    } );

    /**
     * Test returns empty array when no errors
     */
    test( 'returns empty array when no errors in last 7 days', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'sort': jest.fn().mockReturnThis(),
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getRecentUpdateErrors();

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'ensureErrorCollectionIndexes', () => {
    /**
     * Test throws DB_020 error when not connected
     */
    test( 'throws DB_020 error when client is null', async () => {
      await expect( mf.database.ensureErrorCollectionIndexes() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_020)' );
    } );

    /**
     * Test creates TTL index on createdAt field
     */
    test( 'creates TTL index on createdAt field with 7 day expiration', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.createIndex = jest.fn().mockResolvedValue( 'createdAt_1' );

      await mf.database.ensureErrorCollectionIndexes();

      expect( mockDb.collection ).toHaveBeenCalledWith( 'dataUpdateErrors' );
      expect( mockCollection.createIndex ).toHaveBeenCalledWith(
        { 'createdAt': 1 },
        { 'expireAfterSeconds': 604800 }
      );
    } );
  } );
} );
