/**
 * Branch coverage tests for inputValidator module
 * Tests namespace initialization branches
 * @module __tests__/coverage/inputValidator
 */

describe( 'inputValidator - Branch Coverage', () => {
  /**
   * Test that globalThis.mf is initialized when it does not exist
   */
  test( 'initializes globalThis.mf when it does not exist', () => {
    delete globalThis.mf;

    require( '../../services/inputValidator' );

    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.inputValidator ).toBeDefined();
  } );

  /**
   * Test that existing globalThis.mf is reused
   */
  test( 'reuses existing globalThis.mf when it already exists', () => {
    const existingMf = { 'existing': 'data' };

    globalThis.mf = existingMf;

    jest.resetModules();
    require( '../../services/inputValidator' );

    expect( globalThis.mf ).toBe( existingMf );
    expect( globalThis.mf.existing ).toBe( 'data' );
    expect( globalThis.mf.inputValidator ).toBeDefined();
  } );
} );
