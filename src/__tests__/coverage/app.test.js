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

      // Mock logger to create globalThis.mf.logger but not globalThis.mf itself
      jest.doMock( '../../logger', () => {
        // Create globalThis.mf if it doesn't exist (app.js should do this first)
        globalThis.mf = globalThis.mf || {};
        globalThis.mf.logger = {
          'info': jest.fn(),
          'error': jest.fn(),
          'warn': jest.fn(),
          'debug': jest.fn(),
          'level': 'silent'
        };
        return {};
      } );

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

  test( 'covers right side of globalThis.mf || {} when mf is undefined', () => {
    jest.isolateModules( () => {
      // Ensure globalThis.mf is completely undefined before requiring app
      delete globalThis.mf;

      // Mock logger to NOT initialize globalThis.mf
      jest.doMock( '../../logger', () =>
        // Do nothing - let app.js initialize globalThis.mf
        ( {} ) );

      // Mock actService
      jest.doMock( '../../services/actService', () => ( {} ) );

      require( '../../app' );

      // App should have created globalThis.mf via the || {} branch
      expect( globalThis.mf ).toBeDefined();
      expect( globalThis.mf.app ).toBeDefined();
    } );
  } );

  test( 'HTTP logging middleware uses info level in production', () => {
    jest.isolateModules( () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'production';
      delete globalThis.mf;

      // Mock pino to spy on logger calls
      const mockLogger = {
        'info': jest.fn(),
        'error': jest.fn(),
        'warn': jest.fn(),
        'debug': jest.fn(),
        'level': 'info'
      };

      jest.mock( 'pino', () => jest.fn( () => mockLogger ) );

      // Mock logger module to initialize globalThis.mf with mockLogger
      jest.doMock( '../../logger', () => {
        const { AsyncLocalStorage } = require( 'async_hooks' );

        globalThis.mf = globalThis.mf || {};
        globalThis.mf.logger = mockLogger;
        globalThis.mf.asyncLocalStorage = new AsyncLocalStorage();
        return {};
      } );

      const request = require( 'supertest' );

      require( '../../app' );

      // Mock database for /health endpoint
      globalThis.mf.database = {
        'testCacheHealth': jest.fn().mockRejectedValue( new Error( 'Test' ) )
      };

      // Make a request to trigger the middleware
      return request( globalThis.mf.app ).get( '/health' ).then( () => {
        // In production, middleware should log at INFO level
        const logCalls = mockLogger.info.mock.calls.filter( ( call ) => call[ 1 ] === 'HTTP request' );

        expect( logCalls.length ).toBeGreaterThan( 0 );
        expect( logCalls[ 0 ][ 0 ] ).toMatchObject( {
          'method': 'GET',
          'path': '/health',
          'statusCode': expect.any( Number ),
          'duration': expect.any( Number )
        } );

        process.env.NODE_ENV = originalEnv;
        jest.unmock( 'pino' );
      } );
    } );
  } );
} );
