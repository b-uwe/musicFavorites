/**
 * Coverage tests for logger module
 * @module __tests__/coverage/logger
 */

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
} );
