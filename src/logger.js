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

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.logger = globalThis.mf.logger || pino( { 'level': getLogLevel() } );
} )();
