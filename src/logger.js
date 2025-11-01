( () => {
  'use strict';

  /**
   * Application logger module
   * Provides a centralized Pino logger instance configured based on NODE_ENV
   * @module logger
   */

  const pino = require( 'pino' );

  /**
   * Get appropriate log level based on NODE_ENV
   * @returns {string} Log level (silent, info, or debug)
   */
  const getLogLevel = () => {
    if ( process.env.NODE_ENV === 'test' ) {
      return 'silent';
    }
    if ( process.env.NODE_ENV === 'production' ) {
      return 'info';
    }
    return 'debug';
  };

  /**
   * Application logger instance
   * Configured based on NODE_ENV: silent for tests, debug for dev, info for production
   * @type {import('pino').Logger}
   */
  const logger = pino( { 'level': getLogLevel() } );

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.logger = logger;
} )();
