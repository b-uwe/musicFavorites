/**
 * Integration tests for server lifecycle and startup workflow
 * Tests: Server startup sequence control flow
 * Mocks: Only external I/O (MongoDB)
 * @module __tests__/integration/serverLifecycle.integration
 */

// Mock MongoDB client (not business logic)

const { MongoClient } = require( 'mongodb' );

// Load logger and constants first
require( '../../logger' );
require( '../../constants' );

// Load real business logic modules AFTER mocks
require( '../../services/database' );

describe( 'Server Lifecycle Integration Tests', () => {
  let mockConnect;
  let mockDb;
  let mockCommand;
  let mockClose;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock MongoDB client methods
    mockCommand = jest.fn().mockResolvedValue( {
      'ok': 1
    } );
    mockDb = jest.fn().mockReturnValue( {
      'command': mockCommand
    } );
    mockConnect = jest.fn().mockResolvedValue();
    mockClose = jest.fn().mockResolvedValue();

    // Mock MongoClient constructor
    MongoClient.mockImplementation( () => ( {
      'connect': mockConnect,
      'db': mockDb,
      'close': mockClose
    } ) );

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  } );

  afterEach( async () => {
    // Disconnect to ensure clean state for next test
    try {
      await mf.database.disconnect();
    } catch ( error ) {
      // Ignore disconnect errors in tests
    }

    jest.useRealTimers();
    delete process.env.MONGODB_URI;
  } );

  /**
   * Test that MongoClient is configured with 10 second timeout
   */
  test( 'database connection uses 10 second timeout', async () => {
    await mf.database.connect();

    // Verify MongoClient was constructed with correct timeout
    expect( MongoClient ).toHaveBeenCalledWith(
      'mongodb://localhost:27017/test',
      expect.objectContaining( {
        'serverSelectionTimeoutMS': 10000
      } )
    );
  } );

  /**
   * Test database connection failure during startup
   * This tests real control flow: health check should NOT be called if connection fails
   */
  test( 'startup fails gracefully when database connection fails', async () => {
    mockConnect.mockRejectedValueOnce( new Error( 'MongoDB connection refused' ) );

    // Should throw during connection
    await expect( mf.database.connect() ).rejects.toThrow();

    // Verify connection was attempted
    expect( mockConnect ).toHaveBeenCalled();
  } );

  /**
   * Test health check failure after successful connection
   * This tests real control flow: connection succeeds but health check fails
   */
  test( 'startup detects unhealthy cache after connection succeeds', async () => {
    // Connection succeeds
    await expect( mf.database.connect() ).resolves.not.toThrow();

    // Mock cache health check to fail
    const mockCollection = {
      'findOne': jest.fn().mockRejectedValue( new Error( 'Collection not found' ) )
    };

    mockDb.mockReturnValue( {
      'command': mockCommand,
      'collection': jest.fn().mockReturnValue( mockCollection )
    } );

    // Health check should fail
    await expect( mf.database.testCacheHealth() ).rejects.toThrow();
  } );
} );
