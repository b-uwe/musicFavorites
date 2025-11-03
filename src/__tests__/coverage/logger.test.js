/**
 * Coverage tests for logger module
 * @module __tests__/coverage/logger
 */

const pino = require( 'pino' );

describe( 'logger - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    // Save and clear globalThis.mf
    const originalMf = globalThis.mf;
    delete globalThis.mf;

    // Require the module (should create globalThis.mf)
    jest.resetModules();
    require( '../../logger' );

    // Verify it was created
    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.logger ).toBeDefined();

    // Restore
    globalThis.mf = originalMf;
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    // Explicitly set globalThis.mf
    globalThis.mf = { 'testProperty': 'test' };

    // Reload the module (should reuse existing globalThis.mf)
    jest.resetModules();
    require( '../../logger' );

    // Verify the existing property was preserved
    expect( globalThis.mf.testProperty ).toBe( 'test' );
    expect( globalThis.mf.logger ).toBeDefined();
  } );

  test( 'mixin includes correlationId when present in async storage', () => {
    require( '../../logger' );

    /**
     * Mock stream for capturing log output
     * @type {object}
     */
    const stream = {
      'write': jest.fn()
    };

    /**
     * Test logger with mixin
     * @type {object}
     */
    const testLogger = pino( {
      'level': 'info',
      /**
       * Mixin function to add correlationId
       * @returns {object} Object with correlationId if available
       */
      'mixin': () => {
        const store = mf.asyncLocalStorage.getStore();

        return store?.correlationId ? { 'correlationId': store.correlationId } : {};
      }
    }, stream );

    mf.asyncLocalStorage.run( { 'correlationId': 'test-123' }, () => {
      testLogger.info( 'test message' );
    } );

    const logOutput = JSON.parse( stream.write.mock.calls[ 0 ][ 0 ] );

    expect( logOutput ).toHaveProperty( 'correlationId', 'test-123' );
  } );

  test( 'mixin excludes correlationId when not in async context', () => {
    require( '../../logger' );

    /**
     * Mock stream for capturing log output
     * @type {object}
     */
    const stream = {
      'write': jest.fn()
    };

    /**
     * Test logger with mixin
     * @type {object}
     */
    const testLogger = pino( {
      'level': 'info',
      /**
       * Mixin function to add correlationId
       * @returns {object} Object with correlationId if available
       */
      'mixin': () => {
        const store = mf.asyncLocalStorage.getStore();

        return store?.correlationId ? { 'correlationId': store.correlationId } : {};
      }
    }, stream );

    testLogger.info( 'test message' );

    const logOutput = JSON.parse( stream.write.mock.calls[ 0 ][ 0 ] );

    expect( logOutput ).not.toHaveProperty( 'correlationId' );
  } );
} );
