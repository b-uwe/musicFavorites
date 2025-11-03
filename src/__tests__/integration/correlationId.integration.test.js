/**
 * Integration tests for correlation ID propagation
 * Tests: AsyncLocalStorage context propagation through real components
 * Mocks: Only external I/O (none needed for these tests)
 * @module __tests__/integration/correlationId
 */

require( '../../logger' );
require( '../../services/cacheUpdater' );
require( '../../services/fetchQueue' );

describe( 'Correlation ID Propagation Integration', () => {
  beforeEach( () => {
    jest.clearAllMocks();
  } );

  /**
   * Test that asyncLocalStorage.run() propagates context through async operations
   */
  test( 'asyncLocalStorage propagates context through async chain', async () => {
    const testCorrelationId = 'test-correlation-async-chain';
    let capturedCorrelationId = null;

    await mf.asyncLocalStorage.run( { 'correlationId': testCorrelationId }, async () => {
      // Simulate async operation
      await new Promise( ( resolve ) => {
        setTimeout( () => {
          const store = mf.asyncLocalStorage.getStore();

          capturedCorrelationId = store?.correlationId;
          resolve();
        }, 10 );
      } );
    } );

    expect( capturedCorrelationId ).toBe( testCorrelationId );
  } );

  /**
   * Test that nested async operations preserve correlation ID
   */
  test( 'nested async operations preserve correlation ID', async () => {
    const testCorrelationId = 'test-correlation-nested';
    const capturedIds = [];

    await mf.asyncLocalStorage.run( { 'correlationId': testCorrelationId }, async () => {
      // Level 1
      const store1 = mf.asyncLocalStorage.getStore();

      capturedIds.push( store1?.correlationId );

      // Level 2 - nested async
      await new Promise( ( resolve ) => {
        setTimeout( () => {
          const store2 = mf.asyncLocalStorage.getStore();

          capturedIds.push( store2?.correlationId );

          // Level 3 - deeply nested
          new Promise( ( innerResolve ) => {
            setTimeout( () => {
              const store3 = mf.asyncLocalStorage.getStore();

              capturedIds.push( store3?.correlationId );
              innerResolve();
            }, 0 );
          } ).then( resolve );
        }, 0 );
      } );
    } );

    expect( capturedIds ).toEqual( [ testCorrelationId, testCorrelationId, testCorrelationId ] );
  } );

  /**
   * Test that parallel async operations each maintain their correlation ID
   */
  test( 'parallel async operations maintain separate correlation IDs', async () => {
    const results = [];

    const operation1 = mf.asyncLocalStorage.run( { 'correlationId': 'correlation-A' }, async () => {
      await new Promise( ( resolve ) => {
        setTimeout( () => {
          const store = mf.asyncLocalStorage.getStore();

          results.push( { 'op': 'A',
            'correlationId': store?.correlationId } );
          resolve();
        }, 20 );
      } );
    } );

    const operation2 = mf.asyncLocalStorage.run( { 'correlationId': 'correlation-B' }, async () => {
      await new Promise( ( resolve ) => {
        setTimeout( () => {
          const store = mf.asyncLocalStorage.getStore();

          results.push( { 'op': 'B',
            'correlationId': store?.correlationId } );
          resolve();
        }, 10 );
      } );
    } );

    await Promise.all( [ operation1, operation2 ] );

    expect( results ).toContainEqual( {
      'op': 'A',
      'correlationId': 'correlation-A'
    } );
    expect( results ).toContainEqual( {
      'op': 'B',
      'correlationId': 'correlation-B'
    } );
  } );

  /**
   * Test that logger mixin works when correlationId is undefined
   */
  test( 'logger mixin handles undefined correlationId gracefully', () => {
    mf.asyncLocalStorage.run( { 'someOtherField': 'value' }, () => {
      const childLogger = mf.logger.child( {} );
      const bindings = childLogger.bindings();

      expect( bindings ).not.toHaveProperty( 'correlationId' );
    } );
  } );

  /**
   * Test that logger mixin works when store is null
   */
  test( 'logger mixin handles null store gracefully', () => {
    // Outside any asyncLocalStorage.run() context
    const childLogger = mf.logger.child( {} );
    const bindings = childLogger.bindings();

    expect( bindings ).not.toHaveProperty( 'correlationId' );
  } );
} );
