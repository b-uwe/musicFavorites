/**
 * Unit tests for database clearCache function
 * Tests business logic by mocking MongoDB client
 * @module __tests__/unit/services/databaseClearCache
 */

// Mock mongodb before requiring database

describe( 'database.clearCache - Unit Tests', () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let MongoClient;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create mock collection
    mockCollection = {
      'deleteMany': jest.fn()
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

  describe( 'clearCache', () => {
    /**
     * Test throws DB_021 when not connected
     */
    test( 'throws DB_021 error when client is null', async () => {
      await expect( mf.database.clearCache() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_021)' );
    } );

    /**
     * Test successful cache clearing
     */
    test( 'deletes all documents from acts collection', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.deleteMany.mockResolvedValue( {
        'acknowledged': true,
        'deletedCount': 42
      } );

      await mf.database.clearCache();

      expect( mockCollection.deleteMany ).toHaveBeenCalledWith( {} );
      expect( mockDb.collection ).toHaveBeenCalledWith( 'acts' );
    } );

    /**
     * Test throws DB_022 when delete not acknowledged
     */
    test( 'throws DB_022 error when delete not acknowledged', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.deleteMany.mockResolvedValue( { 'acknowledged': false } );

      await expect( mf.database.clearCache() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_022)' );
    } );

    /**
     * Test clears empty cache successfully
     */
    test( 'successfully clears empty cache', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.deleteMany.mockResolvedValue( {
        'acknowledged': true,
        'deletedCount': 0
      } );

      await mf.database.clearCache();

      expect( mockCollection.deleteMany ).toHaveBeenCalledWith( {} );
    } );
  } );
} );
