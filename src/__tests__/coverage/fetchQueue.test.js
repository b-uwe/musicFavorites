/**
 * Coverage tests for fetchQueue module
 * @module __tests__/coverage/fetchQueue
 */

// Mock dependencies to prevent them from initializing globalThis.mf
jest.mock( '../../services/actService', () => ( {} ) );

describe( 'fetchQueue - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    jest.isolateModules( () => {
      const originalMf = globalThis.mf;
      const originalJestId = process.env.JEST_WORKER_ID;
      delete globalThis.mf;
      delete process.env.JEST_WORKER_ID;
      require( '../../services/fetchQueue' );
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.fetchQueue ).toBeDefined();
      globalThis.mf = originalMf;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    jest.isolateModules( () => {
      const originalJestId = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      globalThis.mf = { 'testProperty': 'test' };
      require( '../../services/fetchQueue' );
      expect( globalThis.mf.testProperty ).toBe( 'test' );
      expect( globalThis.mf.fetchQueue ).toBeDefined();
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'initializes globalThis.mf.testing when JEST_WORKER_ID is set', () => {
    jest.isolateModules( () => {
      expect( process.env.JEST_WORKER_ID ).toBeDefined();
      require( '../../services/fetchQueue' );
      expect( globalThis.mf.testing ).toBeDefined();
      expect( globalThis.mf.testing.fetchQueue ).toBeDefined();
    } );
  } );

  test( 'reuses existing globalThis.mf.testing when it already exists', () => {
    jest.isolateModules( () => {
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testing = { 'testProperty': 'test' };
      require( '../../services/fetchQueue' );
      expect( globalThis.mf.testing.testProperty ).toBe( 'test' );
      expect( globalThis.mf.testing.fetchQueue ).toBeDefined();
    } );
  } );
} );
