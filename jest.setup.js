/**
 * Jest setup file
 * Runs before all tests to configure global test environment
 */

// Mock axios globally for all tests
// This prevents accidentally making real HTTP requests in tests
jest.mock( 'axios' );

// Install nock as safety net to block any real HTTP requests at network level
// This catches anything that slips through the axios mock
const nock = require( 'nock' );

// Add event listener to catch and alert on disallowed network connections
nock.emitter.on( 'no match', ( req ) => {
  // Ignore localhost/127.0.0.1 (allowed for supertest)
  if ( req.host.includes( '127.0.0.1' ) || req.host.includes( 'localhost' ) ) {
    return;
  }

  console.error( '\n' );
  console.error( '============================================' );
  console.error( '🚨 UNMOCKED HTTP REQUEST DETECTED! 🚨' );
  console.error( '============================================' );
  console.error( `Method: ${req.method}` );
  console.error( `URL: ${req.protocol}//${req.host}${req.path}` );
  console.error( 'This request was blocked by nock.' );
  console.error( 'Please mock this HTTP call in your test!' );
  console.error( '============================================' );
  console.error( '\n' );
} );

// Disable all real HTTP requests
nock.disableNetConnect();

// Allow localhost connections for supertest (Express app testing)
nock.enableNetConnect( '127.0.0.1' );
