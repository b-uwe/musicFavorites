/**
 * Coverage tests for constants module
 * @module __tests__/coverage/constants
 */

describe( 'constants - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    // Save and clear globalThis.mf
    const originalMf = globalThis.mf;
    delete globalThis.mf;

    // Require the module (should create globalThis.mf)
    jest.resetModules();
    require( '../../constants' );

    // Verify it was created
    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.constants ).toBeDefined();
    expect( globalThis.mf.constants.USER_AGENT ).toContain( 'MusicFavorites' );
    expect( globalThis.mf.constants.HTTP_TIMEOUT ).toBe( 5000 );

    // Restore
    globalThis.mf = originalMf;
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    // Explicitly set globalThis.mf
    globalThis.mf = { 'testProperty': 'test' };

    // Reload the module (should reuse existing globalThis.mf)
    jest.resetModules();
    require( '../../constants' );

    // Verify the existing property was preserved
    expect( globalThis.mf.testProperty ).toBe( 'test' );
    expect( globalThis.mf.constants ).toBeDefined();
  } );
} );
