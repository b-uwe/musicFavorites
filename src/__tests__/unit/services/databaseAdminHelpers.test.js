/**
 * Unit tests for databaseAdmin module helper functions
 * Tests getLogger, logSlowOperation, and updateActMetadata helpers
 * @module __tests__/unit/services/databaseAdminHelpers
 */

describe( 'databaseAdmin - Helper Functions', () => {
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
      'updateOne': jest.fn(),
      'insertOne': jest.fn(),
      'deleteMany': jest.fn(),
      'find': jest.fn()
    };

    // Create mock database
    mockDb = {
      'command': jest.fn(),
      'collection': jest.fn().mockReturnValue( mockCollection )
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

    // Require database module AFTER mocking
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
    // Restore original logger
    if ( originalMfLogger ) {
      globalThis.mf.logger = originalMfLogger;
    }
  } );

  describe( 'getLogger helper', () => {
    /**
     * Test getLogger returns debug level in non-test environment
     */
    test( 'returns debug log level when NODE_ENV is not test', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';

      const result = mf.testing.databaseAdmin.getLogger( 'debug' );

      expect( result.logLevel ).toBe( 'debug' );
      expect( result.logger ).toBe( mockLogger );

      process.env.NODE_ENV = originalEnv;
    } );

    /**
     * Test getLogger returns error level in test environment
     */
    test( 'returns error log level when NODE_ENV is test', () => {
      // NODE_ENV is already 'test' in Jest
      expect( process.env.NODE_ENV ).toBe( 'test' );

      const result = mf.testing.databaseAdmin.getLogger( 'info' );

      // In test mode, logger should use 'error' level regardless of default
      expect( result.logLevel ).toBe( 'error' );
      expect( result.logger ).toBe( mockLogger );
    } );

    /**
     * Test getLogger returns no-op logger when mf.logger is not available
     */
    test( 'returns no-op logger when mf.logger is undefined', () => {
      // Remove mf.logger
      delete globalThis.mf.logger;

      const result = mf.testing.databaseAdmin.getLogger( 'debug' );

      // Should return no-op logger functions
      expect( result.logger ).toBeDefined();
      expect( result.logger.debug ).toBeDefined();
      expect( result.logger.info ).toBeDefined();
      expect( result.logger.warn ).toBeDefined();
      expect( result.logger.error ).toBeDefined();

      // Verify no-op functions don't throw
      expect( () => result.logger.debug( 'test' ) ).not.toThrow();
      expect( () => result.logger.info( 'test' ) ).not.toThrow();
      expect( () => result.logger.warn( 'test' ) ).not.toThrow();
      expect( () => result.logger.error( 'test' ) ).not.toThrow();
    } );
  } );

  describe( 'logSlowOperation helper', () => {
    /**
     * Test logSlowOperation warns for operations > SLOW_QUERY_THRESHOLD_MS
     */
    test( 'logs warning when operation duration exceeds threshold', () => {
      const context = {
        'actId': 'test-id',
        'count': 3
      };
      const slowDuration = mf.constants.SLOW_QUERY_THRESHOLD_MS + 50;

      mf.testing.databaseAdmin.logSlowOperation( mockLogger, 'testOperation', slowDuration, context );

      // Verify warn was called with slow operation details
      expect( mockLogger.warn ).toHaveBeenCalledWith(
        {
          'operation': 'testOperation',
          'duration': slowDuration,
          'actId': 'test-id',
          'count': 3
        },
        'Slow database operation'
      );
    } );

    /**
     * Test logSlowOperation does not warn for fast operations
     */
    test( 'does not log warning when operation duration is under threshold', () => {
      const context = {
        'actId': 'test-id'
      };
      const fastDuration = mf.constants.SLOW_QUERY_THRESHOLD_MS - 50;

      mockLogger.warn.mockClear();

      mf.testing.databaseAdmin.logSlowOperation( mockLogger, 'testOperation', fastDuration, context );

      // Verify warn was NOT called for fast operation
      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation warns for operations exactly at threshold + 1ms
     */
    test( 'logs warning when operation duration is exactly threshold + 1ms', () => {
      const context = { 'count': 10 };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS + 1;

      mf.testing.databaseAdmin.logSlowOperation( mockLogger, 'testOperation', duration, context );

      expect( mockLogger.warn ).toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation does not warn for operations exactly at threshold
     */
    test( 'does not log warning when operation duration is exactly at threshold', () => {
      mockLogger.warn.mockClear();

      const context = { 'count': 10 };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS;

      mf.testing.databaseAdmin.logSlowOperation( mockLogger, 'testOperation', duration, context );

      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'updateActMetadata helper', () => {
    /**
     * Test updateActMetadata successfully updates metadata
     */
    test( 'updates act metadata with correct parameters', async () => {
      // Mock successful update
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      // Call helper directly
      await mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'test-id',
        timestamp
      );

      // Verify updateOne was called with correct parameters
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        { '_id': 'test-id' },
        {
          '$set': {
            'lastRequestedAt': timestamp,
            'updatesSinceLastRequest': 0
          }
        },
        { 'upsert': true }
      );
    } );

    /**
     * Test updateActMetadata throws DB_025 when update not acknowledged
     */
    test( 'throws DB_025 when update is not acknowledged', async () => {
      // Mock failed update
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      // Call helper directly
      await expect( mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'test-id',
        timestamp
      ) ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_025)' );
    } );

    /**
     * Test updateActMetadata with upsert creates new document
     */
    test( 'upserts metadata document when it does not exist', async () => {
      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': true,
        'upsertedCount': 1
      } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      await mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'new-id',
        timestamp
      );

      // Verify upsert option was passed
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { 'upsert': true }
      );
    } );
  } );
} );
