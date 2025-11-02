/**
 * Unit tests for logger module
 * @module __tests__/unit/logger
 */

// Load logger to initialize globalThis.mf
require( '../../logger' );

describe( 'logger', () => {
  test( 'logger is available globally', () => {
    expect( mf.logger ).toBeDefined();
    expect( typeof mf.logger.info ).toBe( 'function' );
    expect( typeof mf.logger.debug ).toBe( 'function' );
    expect( typeof mf.logger.error ).toBe( 'function' );
    expect( typeof mf.logger.warn ).toBe( 'function' );
  } );

  test( 'logger is silent in test environment', () => {
    expect( process.env.NODE_ENV ).toBe( 'test' );
    expect( mf.logger.level ).toBe( 'silent' );
  } );

  test( 'logger uses info level when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Clear singleton instance to force recreation with new NODE_ENV
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    expect( mf.logger.level ).toBe( 'info' );

    process.env.NODE_ENV = originalEnv;
    // Restore original logger
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );

  test( 'logger uses debug level when NODE_ENV is development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Clear singleton instance to force recreation with new NODE_ENV
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    expect( mf.logger.level ).toBe( 'debug' );

    process.env.NODE_ENV = originalEnv;
    // Restore original logger
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );
} );
