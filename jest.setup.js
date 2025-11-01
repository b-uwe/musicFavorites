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

// Disable all real HTTP requests
nock.disableNetConnect();

// Allow localhost connections for supertest (Express app testing)
nock.enableNetConnect( '127.0.0.1' );
