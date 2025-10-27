/**
 * Coverage tests for actService module
 * These tests exercise code paths for 100% branch coverage
 * @module __tests__/coverage/actService
 */

// Mock all dependencies to prevent them from initializing globalThis.mf
jest.mock( '../../services/bandsintownTransformer', () => ( {} ) );
jest.mock( '../../services/cacheUpdater', () => ( {} ) );
jest.mock( '../../services/database', () => ( {} ) );
jest.mock( '../../services/fetchQueue', () => ( {} ) );
jest.mock( '../../services/ldJsonExtractor', () => ( {} ) );
jest.mock( '../../services/musicbrainz', () => ( {} ) );
jest.mock( '../../services/musicbrainzTransformer', () => ( {} ) );

describe( 'actService - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    jest.isolateModules( () => {
      // Save original state
      const originalMf = globalThis.mf;
      const originalJestId = process.env.JEST_WORKER_ID;

      // Clear globalThis.mf to test initialization path
      delete globalThis.mf;
      // Also clear JEST_WORKER_ID to avoid testing.* branch
      delete process.env.JEST_WORKER_ID;

      // Re-require module to trigger initialization
      require( '../../services/actService' );

      // Verify mf was created
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.actService ).toBeDefined();

      // Restore original state
      globalThis.mf = originalMf;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    jest.isolateModules( () => {
      // Save original state
      const originalJestId = process.env.JEST_WORKER_ID;

      // Ensure mf exists with some property
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testProperty = 'test';
      // Clear JEST_WORKER_ID to avoid testing.* branch
      delete process.env.JEST_WORKER_ID;

      // Re-require module
      require( '../../services/actService' );

      // Verify existing properties are preserved
      expect( globalThis.mf.testProperty ).toBe( 'test' );
      expect( globalThis.mf.actService ).toBeDefined();

      // Cleanup
      delete globalThis.mf.testProperty;
      process.env.JEST_WORKER_ID = originalJestId;
    } );
  } );

  test( 'initializes globalThis.mf.testing when JEST_WORKER_ID is set', () => {
    jest.isolateModules( () => {
      // Ensure JEST_WORKER_ID is set (it should be in Jest environment)
      expect( process.env.JEST_WORKER_ID ).toBeDefined();

      // Re-require module
      require( '../../services/actService' );

      // Verify testing namespace was created
      expect( globalThis.mf.testing ).toBeDefined();
      expect( globalThis.mf.testing.actService ).toBeDefined();
      expect( globalThis.mf.testing.actService.withTimeout ).toBeDefined();
    } );
  } );

  test( 'reuses existing globalThis.mf.testing when it already exists', () => {
    jest.isolateModules( () => {
      // Ensure testing namespace exists with some property
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testing = globalThis.mf.testing || {};
      globalThis.mf.testing.testProperty = 'test';

      // Re-require module
      require( '../../services/actService' );

      // Verify existing properties are preserved
      expect( globalThis.mf.testing.testProperty ).toBe( 'test' );
      expect( globalThis.mf.testing.actService ).toBeDefined();

      // Cleanup
      delete globalThis.mf.testing.testProperty;
    } );
  } );
} );
