/**
 * Branch coverage tests for app.js gracefulShutdown function
 * Tests error scenarios and edge cases
 * @module __tests__/coverage/appGracefulShutdown
 */

require( '../../app' );

describe( 'App - Graceful Shutdown Branch Coverage', () => {
  let mockServer;
  let originalProcessExit;
  let originalDatabaseDisconnect;

  beforeEach( () => {
    jest.clearAllMocks();

    // Store original methods
    originalProcessExit = process.exit;
    originalDatabaseDisconnect = mf.database.disconnect;

    // Mock process.exit
    process.exit = jest.fn();

    // Mock server instance
    mockServer = {
      'close': jest.fn( ( callback ) => {
        callback();
      } )
    };

    // Mock database disconnect
    mf.database.disconnect = jest.fn().mockResolvedValue();
  } );

  afterEach( () => {
    // Restore original methods
    process.exit = originalProcessExit;
    mf.database.disconnect = originalDatabaseDisconnect;
  } );

  /**
   * Test catch branch when database disconnect rejects
   */
  test( 'catch block executes when database disconnect fails', () => {
    const disconnectError = new Error( 'DB disconnect failed' );
    mf.database.disconnect.mockRejectedValue( disconnectError );

    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        /*
         * Verify catch block was entered and process.exit still called
         */
        expect( mf.database.disconnect ).toHaveBeenCalled();
        expect( process.exit ).toHaveBeenCalledWith( 0 );
        resolve();
      }, 10 );
    } );
  } );
} );
