/**
 * Coverage tests for databaseAdmin module
 * @module __tests__/coverage/databaseAdmin
 */

describe( 'databaseAdmin - Branch Coverage', () => {
  test( 'initializes globalThis.mf.testing when it does not exist', () => {
    jest.isolateModules( () => {
      // Ensure JEST_WORKER_ID is set
      expect( process.env.JEST_WORKER_ID ).toBeDefined();

      /*
       * Mock the './database' require to prevent it from actually loading
       */
      jest.mock( '../../services/database', () => ( {} ), { 'virtual': false } );

      // Set up minimal mf.database mock that databaseAdmin depends on
      globalThis.mf = {
        'database': {
          'getDatabase': jest.fn()
        }
      };

      // Explicitly delete testing namespace to ensure it doesn't exist
      delete globalThis.mf.testing;

      /*
       * Require databaseAdmin - since ./database is mocked, it won't create mf.testing
       * This triggers the || {} branch since testing doesn't exist yet
       */
      require( '../../services/databaseAdmin' );

      // Verify the defensive || {} worked and created the namespace
      expect( globalThis.mf.testing ).toBeDefined();
      expect( globalThis.mf.testing.databaseAdmin ).toBeDefined();
      expect( globalThis.mf.testing.databaseAdmin.updateActMetadata ).toBeDefined();
    } );
  } );
} );
