/**
 * Unit tests for databaseAdmin clearCache function
 * Tests business logic by mocking MongoDB client
 * @module __tests__/unit/services/databaseClearCache
 */

// Mock mongodb before requiring database

describe( 'databaseAdmin.clearCache - Unit Tests', () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let mockLogger;
  let MongoClient;
  let originalMfLogger;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Load constants first
    require( '../../../constants' );

    // Save original logger
    originalMfLogger = globalThis.mf?.logger;

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create mock logger
    mockLogger = {
      'debug': jest.fn(),
      'info': jest.fn(),
      'warn': jest.fn(),
      'error': jest.fn()
    };

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

    // Set up mf.logger before requiring database
    globalThis.mf = globalThis.mf || {};
    globalThis.mf.logger = mockLogger;

    // Require database module AFTER mocking (sets up mf.database)
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
    // Restore original logger
    if ( originalMfLogger ) {
      globalThis.mf.logger = originalMfLogger;
    }
  } );

  describe( 'clearCache', () => {
    /**
     * Test throws DB_021 when not connected
     */
    test( 'throws DB_021 error when client is null', async () => {
      await expect( mf.databaseAdmin.clearCache() ).
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

      await mf.databaseAdmin.clearCache();

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

      await expect( mf.databaseAdmin.clearCache() ).
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

      await mf.databaseAdmin.clearCache();

      expect( mockCollection.deleteMany ).toHaveBeenCalledWith( {} );
    } );
  } );
} );
