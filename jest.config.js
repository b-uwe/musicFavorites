/**
 * Jest configuration for Music Favorites API
 * @type {import('jest').Config}
 */
module.exports = {
  // Use Node.js test environment
  'testEnvironment': 'node',

  // Coverage settings
  'collectCoverage': false,
  'collectCoverageFrom': [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/index.js'
  ],
  'coverageDirectory': 'coverage',
  'coverageReporters': [ 'text', 'lcov', 'html' ],

  // Test file patterns
  'testMatch': [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],

  // Ignore patterns
  'testPathIgnorePatterns': [
    '/node_modules/'
  ],

  // Clear mocks between tests
  'clearMocks': true,

  // Verbose output
  'verbose': true
};
