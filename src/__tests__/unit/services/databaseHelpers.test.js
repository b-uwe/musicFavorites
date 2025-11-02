/**
 * Unit tests for database module helper functions
 * Tests logSlowOperation helper
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

      mf.testing.database.logSlowOperation( 'testOperation', slowDuration, context );

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

      mf.testing.database.logSlowOperation( 'testOperation', fastDuration, context );

      // Verify warn was NOT called for fast operation
      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation warns for operations exactly at threshold + 1ms
     */
    test( 'logs warning when operation duration is exactly threshold + 1ms', () => {
      const context = { 'actId': 'test-id' };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS + 1;

      mf.testing.database.logSlowOperation( 'testOperation', duration, context );

      expect( mockLogger.warn ).toHaveBeenCalled();
    } );

    /**
     * Test logSlowOperation does not warn for operations exactly at threshold
     */
    test( 'does not log warning when operation duration is exactly at threshold', () => {
      mockLogger.warn.mockClear();

      const context = { 'actId': 'test-id' };
      const duration = mf.constants.SLOW_QUERY_THRESHOLD_MS;

      mf.testing.database.logSlowOperation( 'testOperation', duration, context );

      expect( mockLogger.warn ).not.toHaveBeenCalled();
    } );
  } );
} );
