/**
 * Unit tests for databaseAdmin module exports
 * Tests that databaseAdmin extends the mf namespace correctly
 * @module __tests__/unit/services/databaseAdmin
 */

describe( 'databaseAdmin - Module Exports', () => {
  /**
   * Test that databaseAdmin is loaded and exports are available
   */
  test( 'module exports all admin functions', () => {
    // Load the module
    require( '../../../services/database' );

    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.databaseAdmin ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.clearCache ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.logUpdateError ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.getRecentUpdateErrors ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.ensureErrorCollectionIndexes ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.updateLastRequestedAt ).toBeDefined();
    expect( globalThis.mf.databaseAdmin.removeActsNotRequestedFor14Updates ).toBeDefined();
  } );
} );
