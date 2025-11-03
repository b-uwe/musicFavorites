/**
 * Unit tests for database module helper functions
 * Tests logSlowOperation helper
 * @module __tests__/unit/services/databaseHelpers
 */

describe( 'database - Helper Functions', () => {
  let mockClient;
  let mockDb;
  let MongoClient;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create mock database
    mockDb = {
      'command': jest.fn(),
      'collection': jest.fn()
    };

    // Create mock client
    mockClient = {
      'connect': jest.fn().mockResolvedValue(),
      'close': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( mockDb )
    };

    // Mock MongoClient constructor
    const mongodb = require( 'mongodb' );

    MongoClient = jest.fn().mockImplementation( () => mockClient );
    mongodb.MongoClient = MongoClient;

    // Require database module AFTER mocking
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  describe( 'logSlowOperation helper', () => {
    /**
     * Test logSlowOperation executes function and returns result
     */
    test( 'executes function and returns its result', async () => {
      const testFunction = jest.fn().mockResolvedValue( 'test-result' );
      const warnSpy = jest.spyOn( mf.logger, 'warn' );

      const result = await mf.testing.database.logSlowOperation(
        testFunction,
        'testOperation',
        { 'actId': 'test-id' }
      );

      expect( testFunction ).toHaveBeenCalledTimes( 1 );
      expect( result ).toBe( 'test-result' );
      expect( warnSpy ).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    } );

    /**
     * Test logSlowOperation warns when operation duration exceeds threshold
     */
    test( 'logs warning when operation duration exceeds threshold', async () => {
      const slowFunction = jest.fn().mockImplementation( async () => {
        await new Promise( ( resolve ) => {
          setTimeout( resolve, mf.constants.SLOW_QUERY_THRESHOLD_MS + 50 );
        } );

        return 'slow-result';
      } );

      const warnSpy = jest.spyOn( mf.logger, 'warn' );

      const result = await mf.testing.database.logSlowOperation(
        slowFunction,
        'testOperation',
        { 'actId': 'test-id' }
      );

      expect( result ).toBe( 'slow-result' );
      expect( warnSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'operation': 'testOperation',
          'actId': 'test-id'
        } ),
        'Slow database operation'
      );
      expect( warnSpy.mock.calls[ 0 ][ 0 ].duration ).toBeGreaterThan( mf.constants.SLOW_QUERY_THRESHOLD_MS );

      warnSpy.mockRestore();
    } );

    /**
     * Test logSlowOperation does not warn for fast operations
     */
    test( 'does not log warning when operation duration is under threshold', async () => {
      const fastFunction = jest.fn().mockResolvedValue( 'fast-result' );
      const warnSpy = jest.spyOn( mf.logger, 'warn' );

      const result = await mf.testing.database.logSlowOperation(
        fastFunction,
        'testOperation',
        { 'actId': 'test-id' }
      );

      expect( result ).toBe( 'fast-result' );
      expect( warnSpy ).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    } );

    /**
     * Test logSlowOperation works with synchronous functions
     */
    test( 'works with synchronous functions', async () => {
      const syncFunction = jest.fn().mockReturnValue( 'sync-result' );
      const warnSpy = jest.spyOn( mf.logger, 'warn' );

      const result = await mf.testing.database.logSlowOperation(
        syncFunction,
        'testOperation',
        { 'actId': 'test-id' }
      );

      expect( result ).toBe( 'sync-result' );
      expect( syncFunction ).toHaveBeenCalledTimes( 1 );
      expect( warnSpy ).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    } );

    /**
     * Test logSlowOperation includes context in warning
     */
    test( 'includes context in warning when operation is slow', async () => {
      const slowFunction = jest.fn().mockImplementation( async () => {
        await new Promise( ( resolve ) => {
          setTimeout( resolve, mf.constants.SLOW_QUERY_THRESHOLD_MS + 50 );
        } );

        return 'result';
      } );

      const warnSpy = jest.spyOn( mf.logger, 'warn' );
      const context = {
        'actId': 'test-id',
        'count': 5
      };

      await mf.testing.database.logSlowOperation(
        slowFunction,
        'testOperation',
        context
      );

      expect( warnSpy ).toHaveBeenCalledWith(
        expect.objectContaining( {
          'operation': 'testOperation',
          'actId': 'test-id',
          'count': 5
        } ),
        'Slow database operation'
      );

      warnSpy.mockRestore();
    } );

    /**
     * Test logSlowOperation uses empty object as default context
     */
    test( 'uses empty object as default context when not provided', async () => {
      const testFunction = jest.fn().mockResolvedValue( 'test-result' );
      const warnSpy = jest.spyOn( mf.logger, 'warn' );

      const result = await mf.testing.database.logSlowOperation(
        testFunction,
        'testOperation'
        // Note: NOT providing context parameter to test default value
      );

      expect( testFunction ).toHaveBeenCalledTimes( 1 );
      expect( result ).toBe( 'test-result' );
      expect( warnSpy ).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    } );
  } );
} );
