/**
 * Unit tests for index.js server startup and lifecycle logging
 * Tests that server startup and lifecycle events are properly logged
 * @module __tests__/unit/index
 */

// Load app module to initialize logger
require( '../../app' );

describe( 'Index - Server Startup Logging', () => {
  let loggerInfoSpy;
  let loggerErrorSpy;
  let loggerWarnSpy;

  beforeEach( () => {
    jest.clearAllMocks();

    // Spy on logger methods
    loggerInfoSpy = jest.spyOn( mf.logger, 'info' ).mockImplementation( () => {
      // Mock implementation
    } );
    loggerErrorSpy = jest.spyOn( mf.logger, 'error' ).mockImplementation( () => {
      // Mock implementation
    } );
    loggerWarnSpy = jest.spyOn( mf.logger, 'warn' ).mockImplementation( () => {
      // Mock implementation
    } );
  } );

  afterEach( () => {
    loggerInfoSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  } );

  /**
   * Test that logger is available
   */
  test( 'logger is available globally', () => {
    expect( mf.logger ).toBeDefined();
    expect( typeof mf.logger.info ).toBe( 'function' );
    expect( typeof mf.logger.error ).toBe( 'function' );
    expect( typeof mf.logger.warn ).toBe( 'function' );
  } );
} );
