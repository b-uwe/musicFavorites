/**
 * Unit tests for app.js gracefulShutdown function
 * Tests graceful shutdown logic with proper sequencing
 * @module __tests__/unit/appGracefulShutdown
 */

require( '../../app' );

describe( 'App - Graceful Shutdown Function', () => {
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
   * Test that gracefulShutdown function exists
   */
  test( 'exposes gracefulShutdown function', () => {
    expect( mf.gracefulShutdown ).toBeDefined();
    expect( typeof mf.gracefulShutdown ).toBe( 'function' );
  } );

  /**
   * Test gracefulShutdown calls server.close
   */
  test( 'calls server.close when invoked', () => {
    mf.gracefulShutdown( mockServer );

    expect( mockServer.close ).toHaveBeenCalledWith( expect.any( Function ) );
  } );

  /**
   * Test gracefulShutdown calls database.disconnect after server.close
   */
  test( 'calls database.disconnect after server.close', () => {
    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        expect( mockServer.close ).toHaveBeenCalled();
        expect( mf.database.disconnect ).toHaveBeenCalled();

        /*
         * Verify call order
         */
        const [ serverCallOrder ] = mockServer.close.mock.invocationCallOrder;
        const [ dbCallOrder ] = mf.database.disconnect.mock.invocationCallOrder;
        expect( serverCallOrder ).toBeLessThan( dbCallOrder );
        resolve();
      }, 10 );
    } );
  } );

  /**
   * Test gracefulShutdown calls process.exit after cleanup
   */
  test( 'calls process.exit(0) after database disconnect', () => {
    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        expect( process.exit ).toHaveBeenCalledWith( 0 );
        resolve();
      }, 10 );
    } );
  } );

  /**
   * Test complete shutdown sequence order
   */
  test( 'executes shutdown sequence in correct order', () => {
    const callOrder = [];

    mockServer.close.mockImplementation( ( callback ) => {
      callOrder.push( 'server.close' );
      callback();
    } );

    mf.database.disconnect.mockImplementation( () => {
      callOrder.push( 'database.disconnect' );

      return Promise.resolve();
    } );

    process.exit.mockImplementation( ( code ) => {
      callOrder.push( `process.exit(${code})` );
    } );

    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        expect( callOrder ).toEqual( [
          'server.close',
          'database.disconnect',
          'process.exit(0)'
        ] );
        resolve();
      }, 10 );
    } );
  } );

  /**
   * Test gracefulShutdown handles database disconnect failure
   */
  test( 'handles database disconnect failure gracefully', () => {
    const disconnectError = new Error( 'DB disconnect failed' );
    mf.database.disconnect.mockRejectedValue( disconnectError );

    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        expect( mockServer.close ).toHaveBeenCalled();
        expect( mf.database.disconnect ).toHaveBeenCalled();

        /*
         * Process.exit should still be called even when disconnect fails
         * Graceful shutdown continues despite errors
         */
        expect( process.exit ).toHaveBeenCalledWith( 0 );
        resolve();
      }, 10 );
    } );
  } );

  /**
   * Test gracefulShutdown with async server.close callback
   */
  test( 'waits for server.close callback before disconnecting database', () => {
    const callOrder = [];
    let closeCallbackCalled = false;

    mockServer.close.mockImplementation( ( callback ) => {
      callOrder.push( 'server.close.start' );
      setTimeout( () => {
        callOrder.push( 'server.close.callback' );
        closeCallbackCalled = true;
        callback();
      }, 5 );
    } );

    mf.database.disconnect.mockImplementation( () => {
      callOrder.push( 'database.disconnect' );
      expect( closeCallbackCalled ).toBe( true );

      return Promise.resolve();
    } );

    mf.gracefulShutdown( mockServer );

    return new Promise( ( resolve ) => {
      setTimeout( () => {
        expect( callOrder ).toContain( 'server.close.start' );
        expect( callOrder ).toContain( 'server.close.callback' );
        expect( callOrder ).toContain( 'database.disconnect' );

        /*
         * Verify callback was executed before disconnect
         */
        const callbackIndex = callOrder.indexOf( 'server.close.callback' );
        const disconnectIndex = callOrder.indexOf( 'database.disconnect' );
        expect( callbackIndex ).toBeLessThan( disconnectIndex );
        resolve();
      }, 20 );
    } );
  } );
} );
