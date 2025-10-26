/**
 * Coverage tests for app module
 * @module __tests__/coverage/app
 */

// Mock artistService to prevent it from initializing globalThis.mf
jest.mock( '../../services/artistService', () => ( {} ) );

describe( 'app - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    jest.isolateModules( () => {
      const originalMf = globalThis.mf;
      delete globalThis.mf;
      require( '../../app' );
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.app ).toBeDefined();
      globalThis.mf = originalMf;
    } );
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    jest.isolateModules( () => {
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.testProperty = 'test';
      require( '../../app' );
      expect( globalThis.mf.testProperty ).toBe( 'test' );
      expect( globalThis.mf.app ).toBeDefined();
      delete globalThis.mf.testProperty;
    } );
  } );
} );
