/**
 * Coverage tests for MusicBrainz API client
 * @module __tests__/coverage/musicbrainz
 *
 * IMPORTANT: Mock constants.js to prevent it from initializing globalThis.mf
 */

// Mock axios to prevent actual HTTP calls
jest.mock( 'axios' );

// Mock constants.js WITHOUT initializing globalThis.mf
jest.mock( '../../constants', () => ( {} ), { 'virtual': false } );

describe( 'musicbrainz - Branch Coverage', () => {
  test( 'initializes globalThis.mf when it does not exist', () => {
    // Save and clear globalThis.mf
    const originalMf = globalThis.mf;
    delete globalThis.mf;

    // Require the module (should create globalThis.mf)
    jest.resetModules();
    require( '../../services/musicbrainz' );

    // Verify it was created
    expect( globalThis.mf ).toBeDefined();
    expect( globalThis.mf.musicbrainz ).toBeDefined();

    // Restore
    globalThis.mf = originalMf;
  } );

  test( 'reuses existing globalThis.mf when it already exists', () => {
    // Explicitly set globalThis.mf
    globalThis.mf = { 'testProperty': 'test' };

    // Reload the module (should reuse existing globalThis.mf)
    jest.resetModules();
    require( '../../services/musicbrainz' );

    // Verify the existing property was preserved
    expect( globalThis.mf.testProperty ).toBe( 'test' );
    expect( globalThis.mf.musicbrainz ).toBeDefined();
  } );
} );
