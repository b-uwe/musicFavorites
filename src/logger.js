( () => {
  'use strict';

  /**
   * Application logger module
   * Provides a centralized Pino logger instance configured based on NODE_ENV
   * Includes AsyncLocalStorage for automatic correlation ID propagation
   * @module logger
   */

  const { AsyncLocalStorage } = require( 'async_hooks' );
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

  // Create AsyncLocalStorage instance for correlation ID propagation
  globalThis.mf.asyncLocalStorage = globalThis.mf.asyncLocalStorage || new AsyncLocalStorage();

  /**
   * Mixin function to automatically include correlationId in all log entries
   * @returns {object} Object containing correlationId if available in async context
   */
  const correlationMixin = () => {
    const store = globalThis.mf.asyncLocalStorage.getStore();

    return store?.correlationId ? { 'correlationId': store.correlationId } : {};
  };

  // Create logger with correlation mixin
  globalThis.mf.logger = globalThis.mf.logger || pino( {
    'level': getLogLevel(),
    'mixin': correlationMixin
  } );
} )();
