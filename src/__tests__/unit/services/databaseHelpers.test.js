/**
 * Unit tests for database module helper functions
 * Tests getLogger, logSlowOperation, and verifyConnection helpers
 * @module __tests__/unit/services/databaseHelpers
 */

describe( 'database - Helper Functions', () => {
  let mockClient;
  let mockDb;
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

    // Create mock database
    mockDb = {
      'command': jest.fn(),
      'collection': jest.fn()
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

      const result = mf.testing.database.getLogger( 'debug' );

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

      const result = mf.testing.database.getLogger( 'info' );

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

      const result = mf.testing.database.getLogger( 'debug' );

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
        'count': 5
      };
      const slowDuration = mf.constants.SLOW_QUERY_THRESHOLD_MS + 50;

      mf.testing.database.logSlowOperation( mockLogger, 'testOperation', slowDuration, context );

      // Verify warn was called with slow operation details
      expect( mockLogger.warn ).toHaveBeenCalledWith(
        {
          'operation': 'testOperation',
          'duration': slowDuration,
          'actId': 'test-id',
          'count': 5
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

      mf.testing.database.logSlowOperation( mockLogger, 'testOperation', fastDuration, context );

      // Verify warn was NOT called for fast operation
      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation warns for operations exactly at threshold + 1ms
     */
    test( 'logs warning when operation duration is exactly threshold + 1ms', () => {
      const context = { 'actId': 'test-id' };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS + 1;

      mf.testing.database.logSlowOperation( mockLogger, 'testOperation', duration, context );

      expect( mockLogger.warn ).toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation does not warn for operations exactly at threshold
     */
    test( 'does not log warning when operation duration is exactly at threshold', () => {
      mockLogger.warn.mockClear();

      const context = { 'actId': 'test-id' };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS;

      mf.testing.database.logSlowOperation( mockLogger, 'testOperation', duration, context );

      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );
  } );
} );
