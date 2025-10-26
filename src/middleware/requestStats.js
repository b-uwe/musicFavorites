/**
 * Request statistics tracking middleware
 * @module middleware/requestStats
 */

( () => {
  'use strict';

  let totalRequests = 0;

  /**
   * Middleware to track request statistics
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {void}
   */
  const middleware = ( req, res, next ) => {
    totalRequests += 1;
    next();
  };

  /**
   * Gets current request statistics
   * @returns {object} Statistics object with totalRequests
   */
  const getStats = () => ( {
    totalRequests
  } );

  /**
   * Resets request statistics to zero
   * @returns {void}
   */
  const reset = () => {
    totalRequests = 0;
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.requestStats = {
    middleware,
    getStats,
    reset
  };
} )();
