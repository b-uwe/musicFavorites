/**
 * Coverage tests for cacheUpdater module
 * These tests exercise code paths for 100% branch coverage
 * @module __tests__/coverage/cacheUpdater
 */

// Mock dependencies to prevent them from initializing globalThis.mf
jest.mock( '../../services/database', () => ( {} ) );
jest.mock( '../../services/actService', () => ( {} ) );

describe( 'cacheUpdater - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    jest.isolateModules( () => {
      const originalMf = globalThis.mf;
      const originalJestId = process.env.JEST_WORKER_ID;
      delete globalThis.mf;
      delete process.env.JEST_WORKER_ID;
      require( '../../services/cacheUpdater' );
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.cacheUpdater ).toBeDefined();
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
      require( '../../services/cacheUpdater' );
      expect( globalThis.mf.testProperty ).toBe( 'test' );
      expect( globalThis.mf.cacheUpdater ).toBeDefined();
      delete globalThis.mf.testProperty;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'initializes globalThis.mf.testing when JEST_WORKER_ID is set', () => {
    jest.isolateModules( () => {
      expect( process.env.JEST_WORKER_ID ).toBeDefined();
      require( '../../services/cacheUpdater' );
      expect( globalThis.mf.testing ).toBeDefined();
      expect( globalThis.mf.testing.cacheUpdater ).toBeDefined();
    } );
  } );

  test( 'reuses existing globalThis.mf.testing when it already exists', () => {
    jest.isolateModules( () => {
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testing = globalThis.mf.testing || {};
      globalThis.mf.testing.testProperty = 'test';
      require( '../../services/cacheUpdater' );
      expect( globalThis.mf.testing.testProperty ).toBe( 'test' );
      expect( globalThis.mf.testing.cacheUpdater ).toBeDefined();
      delete globalThis.mf.testing.testProperty;
    } );
  } );
} );
