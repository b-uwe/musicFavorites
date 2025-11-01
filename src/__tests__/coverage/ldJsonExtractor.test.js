/**
 * Coverage tests for ldJsonExtractor module
 * @module __tests__/coverage/ldJsonExtractor
 */

// Mock constants to prevent it from initializing globalThis.mf
jest.mock( '../../constants', () => ( {} ) );

// Mock logger to prevent it from initializing globalThis.mf
jest.mock( '../../logger', () => ( {} ) );

describe( 'ldJsonExtractor - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    jest.isolateModules( () => {
      const originalMf = globalThis.mf;
      const originalJestId = process.env.JEST_WORKER_ID;
      delete globalThis.mf;
      delete process.env.JEST_WORKER_ID;
      require( '../../services/ldJsonExtractor' );
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.ldJsonExtractor ).toBeDefined();
      globalThis.mf = originalMf;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    jest.isolateModules( () => {
      const originalJestId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testProperty = 'test';
      require( '../../services/ldJsonExtractor' );
      expect( globalThis.mf.testProperty ).toBe( 'test' );
      expect( globalThis.mf.ldJsonExtractor ).toBeDefined();
      delete globalThis.mf.testProperty;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'initializes globalThis.mf.testing when JEST_WORKER_ID is set', () => {
    jest.isolateModules( () => {
      expect( process.env.JEST_WORKER_ID ).toBeDefined();
      require( '../../services/ldJsonExtractor' );
      expect( globalThis.mf.testing ).toBeDefined();
      expect( globalThis.mf.testing.ldJsonExtractor ).toBeDefined();
    } );
  } );

  test( 'reuses existing globalThis.mf.testing when it already exists', () => {
    jest.isolateModules( () => {
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testing = globalThis.mf.testing || {};
      globalThis.mf.testing.testProperty = 'test';
      require( '../../services/ldJsonExtractor' );
      expect( globalThis.mf.testing.testProperty ).toBe( 'test' );
      expect( globalThis.mf.testing.ldJsonExtractor ).toBeDefined();
      delete globalThis.mf.testing.testProperty;
    } );
  } );
} );
