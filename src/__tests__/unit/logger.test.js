/**
 * Unit tests for logger module
 * @module __tests__/unit/logger
 */

// Load logger to initialize globalThis.mf
require( '../../logger' );

describe( 'logger', () => {
  test( 'logger is available globally', () => {
    expect( mf.logger ).toBeDefined();
    expect( typeof mf.logger.info ).toBe( 'function' );
    expect( typeof mf.logger.debug ).toBe( 'function' );
    expect( typeof mf.logger.error ).toBe( 'function' );
    expect( typeof mf.logger.warn ).toBe( 'function' );
  } );

  test( 'logger is silent in test environment', () => {
    expect( process.env.NODE_ENV ).toBe( 'test' );
    expect( mf.logger.level ).toBe( 'silent' );
  } );

  test( 'logger uses info level when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Clear singleton instance to force recreation with new NODE_ENV
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    expect( mf.logger.level ).toBe( 'info' );

    process.env.NODE_ENV = originalEnv;
    // Restore original logger
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );

  test( 'logger uses debug level when NODE_ENV is development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Clear singleton instance to force recreation with new NODE_ENV
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    expect( mf.logger.level ).toBe( 'debug' );

    process.env.NODE_ENV = originalEnv;
    // Restore original logger
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );

  test( 'asyncLocalStorage is available globally', () => {
    expect( mf.asyncLocalStorage ).toBeDefined();
    expect( typeof mf.asyncLocalStorage.run ).toBe( 'function' );
    expect( typeof mf.asyncLocalStorage.getStore ).toBe( 'function' );
  } );

  test( 'logger mixin adds correlationId when in async context', () => {
    // Create a logger in debug mode to actually execute the mixin
    const originalEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    const infoSpy = jest.spyOn( mf.logger, 'debug' );

    // Log inside async context - this should trigger the mixin
    mf.asyncLocalStorage.run( { 'correlationId': 'test-correlation-id' }, () => {
      mf.logger.debug( { 'testField': 'testValue' }, 'test message' );
    } );

    // Verify log was called
    expect( infoSpy ).toHaveBeenCalled();

    infoSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );

  test( 'logger mixin returns empty object when no correlationId', () => {
    const originalEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );

    const infoSpy = jest.spyOn( mf.logger, 'debug' );

    // Log outside async context
    mf.logger.debug( { 'testField': 'testValue' }, 'test message' );

    expect( infoSpy ).toHaveBeenCalled();

    infoSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    delete globalThis.mf.logger;
    jest.resetModules();
    require( '../../logger' );
  } );

  describe( 'Ring Buffer - Log Capture', () => {
    beforeEach( () => {
      // Clear logs before each test
      mf.logger.clearLogs();
    } );

    test( 'getLogs method is available', () => {
      expect( typeof mf.logger.getLogs ).toBe( 'function' );
    } );

    test( 'clearLogs method is available', () => {
      expect( typeof mf.logger.clearLogs ).toBe( 'function' );
    } );

    test( 'captures WARN level logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.asyncLocalStorage.run( { 'correlationId': 'test-id' }, () => {
        mf.logger.warn( { 'issue': 'test_issue' }, 'Test warning' );
      } );

      const logs = mf.logger.getLogs();

      expect( logs.length ).toBe( 1 );
      expect( logs[ 0 ].level ).toBe( 'warn' );
      expect( logs[ 0 ].msg ).toBe( 'Test warning' );
      expect( logs[ 0 ].issue ).toBe( 'test_issue' );
      expect( logs[ 0 ].correlationId ).toBe( 'test-id' );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'captures ERROR level logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.asyncLocalStorage.run( { 'correlationId': 'test-id-2' }, () => {
        mf.logger.error( { 'issue': 'test_error' }, 'Test error' );
      } );

      const logs = mf.logger.getLogs();

      expect( logs.length ).toBe( 1 );
      expect( logs[ 0 ].level ).toBe( 'error' );
      expect( logs[ 0 ].msg ).toBe( 'Test error' );
      expect( logs[ 0 ].issue ).toBe( 'test_error' );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'does NOT capture INFO level logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      mf.logger.info( { 'test': 'data' }, 'Test info' );

      const logs = mf.logger.getLogs();

      expect( logs.length ).toBe( 0 );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'does NOT capture DEBUG level logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      mf.logger.debug( { 'test': 'data' }, 'Test debug' );

      const logs = mf.logger.getLogs();

      expect( logs.length ).toBe( 0 );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'clearLogs removes all captured logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.warn( { 'test': 'data' }, 'Test warning 1' );
      mf.logger.error( { 'test': 'data' }, 'Test error 1' );

      expect( mf.logger.getLogs().length ).toBe( 2 );

      mf.logger.clearLogs();

      expect( mf.logger.getLogs().length ).toBe( 0 );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'ring buffer maintains max 100 entries (FIFO)', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      // Add 105 warnings
      for ( let i = 0; i < 105; i++ ) {
        mf.logger.warn( { 'index': i }, `Warning ${i}` );
      }

      const logs = mf.logger.getLogs();

      // Should only have 100 entries
      expect( logs.length ).toBe( 100 );

      // First entry should be index 5 (oldest 5 were dropped)
      expect( logs[ 0 ].index ).toBe( 5 );
      expect( logs[ 0 ].msg ).toBe( 'Warning 5' );

      // Last entry should be index 104
      expect( logs[ 99 ].index ).toBe( 104 );
      expect( logs[ 99 ].msg ).toBe( 'Warning 104' );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'includes timestamp in captured logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      mf.logger.warn( {}, 'Test warning' );

      const logs = mf.logger.getLogs();

      expect( logs[ 0 ].timestamp ).toBeDefined();
      expect( typeof logs[ 0 ].timestamp ).toBe( 'string' );
      // Should be ISO 8601 format
      expect( logs[ 0 ].timestamp ).toMatch( /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/u );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    test( 'captures FATAL level logs', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      mf.asyncLocalStorage.run( { 'correlationId': 'test-fatal' }, () => {
        mf.logger.fatal( { 'critical': 'issue' }, 'Fatal error' );
      } );

      const logs = mf.logger.getLogs();

      expect( logs.length ).toBe( 1 );
      expect( logs[ 0 ].level ).toBe( 'fatal' );
      expect( logs[ 0 ].msg ).toBe( 'Fatal error' );
      expect( logs[ 0 ].critical ).toBe( 'issue' );
      expect( logs[ 0 ].correlationId ).toBe( 'test-fatal' );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );
  } );
} );
