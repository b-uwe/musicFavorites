( () => {
  'use strict';

  /**
   * Application-wide constants
   * @module constants
   */

  const { version } = require( '../package.json' );

  /**
   * User-Agent string for HTTP requests
   * Identifies the application to external services
   * @constant {string}
   */
  const USER_AGENT = `MusicFavorites/${version} (https://github.com/b-uwe/musicFavorites // mscbrnz@tunixgut.de)`;

  /**
   * Default timeout for HTTP requests in milliseconds
   * @constant {number}
   */
  const HTTP_TIMEOUT = 5000;

  /**
   * Threshold for slow database operation warnings in milliseconds
   * Operations exceeding this duration will log a warning
   * @constant {number}
   */
  const SLOW_QUERY_THRESHOLD_MS = 250;

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.constants = {
    USER_AGENT,
    HTTP_TIMEOUT,
    SLOW_QUERY_THRESHOLD_MS
  };
} )();
