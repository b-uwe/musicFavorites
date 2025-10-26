/**
 * Coverage tests for bandsintownTransformer module
 * @module __tests__/coverage/bandsintownTransformer
 */

describe( 'bandsintownTransformer - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    const originalMf = globalThis.mf;
    const originalJestId = process.env.JEST_WORKER_ID;
    delete globalThis.mf;
    delete process.env.JEST_WORKER_ID;
    jest.resetModules();
    require( '../../services/bandsintownTransformer' );
    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.bandsintownTransformer ).toBeDefined();
    globalThis.mf = originalMf;
    process.env.JEST_WORKER_ID = originalJestId;
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    const originalJestId = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    globalThis.mf = globalThis.mf || {};
    globalThis.mf.testProperty = 'test';
    jest.resetModules();
    require( '../../services/bandsintownTransformer' );
    expect( globalThis.mf.testProperty ).toBe( 'test' );
    expect( globalThis.mf.bandsintownTransformer ).toBeDefined();
    delete globalThis.mf.testProperty;
    process.env.JEST_WORKER_ID = originalJestId;
  } );

  test( 'initializes globalThis.mf.testing when JEST_WORKER_ID is set', () => {
    expect( process.env.JEST_WORKER_ID ).toBeDefined();
    jest.resetModules();
    require( '../../services/bandsintownTransformer' );
    expect( globalThis.mf.testing ).toBeDefined();
    expect( globalThis.mf.testing.bandsintownTransformer ).toBeDefined();
  } );

  test( 'reuses existing globalThis.mf.testing when it already exists', () => {
    globalThis.mf = globalThis.mf || {};
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.testProperty = 'test';
    jest.resetModules();
    require( '../../services/bandsintownTransformer' );
    expect( globalThis.mf.testing.testProperty ).toBe( 'test' );
    expect( globalThis.mf.testing.bandsintownTransformer ).toBeDefined();
    delete globalThis.mf.testing.testProperty;
  } );
} );
