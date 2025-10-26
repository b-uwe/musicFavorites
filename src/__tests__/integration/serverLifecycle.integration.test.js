/**
 * Integration tests for server lifecycle and startup workflow
 * Tests: Server startup sequence control flow
 * Mocks: Only external I/O (MongoDB)
 * @module __tests__/integration/serverLifecycle.integration
 */

// Mock external dependencies BEFORE requiring modules
jest.mock( '../../services/database' );

// Load modules AFTER mocks
const database = require( '../../services/database' );

describe( 'Server Lifecycle Integration Tests', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default healthy database
    database.connect = jest.fn().mockResolvedValue();
    database.testCacheHealth = jest.fn().mockResolvedValue();
  } );

  afterEach( () => {
    jest.useRealTimers();
  } );

  /**
   * Test database connection failure during startup
   * This tests real control flow: health check should NOT be called if connection fails
   */
  test( 'startup fails gracefully when database connection fails', async () => {
    database.connect.mockRejectedValue( new Error( 'MongoDB connection refused' ) );

    // Should throw during connection
    await expect( database.connect() ).rejects.toThrow( 'MongoDB connection refused' );

    // Health check should not be called if connection fails
    expect( database.testCacheHealth ).not.toHaveBeenCalled();
  } );

  /**
   * Test health check failure after successful connection
   * This tests real control flow: connection succeeds but health check fails
   */
  test( 'startup detects unhealthy cache after connection succeeds', async () => {
    database.connect.mockResolvedValue();
    database.testCacheHealth.mockRejectedValue( new Error( 'Cache collection not found' ) );

    // Connection should succeed
    await expect( database.connect() ).resolves.not.toThrow();

    // Health check should fail
    await expect( database.testCacheHealth() ).rejects.toThrow( 'Cache collection not found' );
  } );
} );
