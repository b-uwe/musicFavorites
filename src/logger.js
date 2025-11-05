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

  /**
   * Get log level string from Pino level number
   * @param {number} level - Pino log level number
   * @returns {string} Log level string
   */
  const getLevelString = ( level ) => {
    if ( level === 40 ) {
      return 'warn';
    }
    if ( level === 50 ) {
      return 'error';
    }
    return 'fatal';
  };

  /**
   * Circular buffer for capturing WARN+ level logs
   * Max 100 entries, FIFO when full
   */
  const logBuffer = {
    'logs': [],
    'maxSize': 100,

    /**
     * Add a log entry to the buffer
     * @param {number} level - Pino log level number
     * @param {object} obj - Structured log data
     * @param {string} msg - Log message
     * @param {string} correlationId - Request correlation ID
     */
    add ( level, obj, msg, correlationId ) {
      // Only capture WARN (40) and above (ERROR=50, FATAL=60)
      if ( level < 40 ) {
        return;
      }

      if ( this.logs.length >= this.maxSize ) {
        this.logs.shift();
      }

      this.logs.push( {
        'timestamp': new Date().toISOString(),
        'level': getLevelString( level ),
        correlationId,
        msg,
        ...obj
      } );
    },

    /**
     * Get all captured logs
     * @returns {Array} Array of log entries
     */
    getLogs () {
      return [ ...this.logs ];
    },

    /**
     * Clear all captured logs
     */
    clear () {
      this.logs = [];
    }
  };

  /**
   * Custom log method hook to capture logs to buffer
   * Pino requires this to be a named function with 'this' binding
   * @param {Array} args - Log method arguments
   * @param {Function} method - Original log method
   * @param {number} level - Pino log level number
   */
  // eslint-disable-next-line func-names
  const logMethodHook = function ( args, method, level ) {
    // Capture to buffer before logging
    const store = globalThis.mf.asyncLocalStorage.getStore();
    const correlationId = store?.correlationId;
    const [ obj, msg ] = args;

    logBuffer.add( level, obj, msg, correlationId );

    // Call original log method - Pino requires 'this' binding
    // eslint-disable-next-line no-invalid-this
    method.apply( this, args );
  };

  // Create logger with correlation mixin and log capture hook
  globalThis.mf.logger = globalThis.mf.logger || pino( {
    'level': getLogLevel(),
    'mixin': correlationMixin,
    'hooks': {
      'logMethod': logMethodHook
    }
  } );

  // Expose log buffer methods
  globalThis.mf.logger.getLogs = logBuffer.getLogs.bind( logBuffer );
  globalThis.mf.logger.clearLogs = logBuffer.clear.bind( logBuffer );
} )();
