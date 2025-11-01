/**
 * Coverage tests for app module
 * @module __tests__/coverage/app
 */

// Mock actService to prevent it from initializing globalThis.mf
jest.mock( '../../services/actService', () => ( {} ) );

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

  test( 'initializes usageStats object', () => {
    jest.isolateModules( () => {
      delete globalThis.mf;
      require( '../../app' );
      expect( globalThis.mf.usageStats ).toBeDefined();
      expect( globalThis.mf.usageStats ).toHaveProperty( 'requests', 0 );
      expect( globalThis.mf.usageStats ).toHaveProperty( 'actsQueried', 0 );
    } );
  } );

  test( 'logger uses info level when NODE_ENV is production', () => {
    jest.isolateModules( () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete globalThis.mf;
      require( '../../app' );
      expect( globalThis.mf.logger ).toBeDefined();
      expect( globalThis.mf.logger.level ).toBe( 'info' );
      process.env.NODE_ENV = originalEnv;
    } );
  } );

  test( 'logger uses debug level when NODE_ENV is development', () => {
    jest.isolateModules( () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete globalThis.mf;
      require( '../../app' );
      expect( globalThis.mf.logger ).toBeDefined();
      expect( globalThis.mf.logger.level ).toBe( 'debug' );
      process.env.NODE_ENV = originalEnv;
    } );
  } );
} );
