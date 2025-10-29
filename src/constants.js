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

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.constants = {
    USER_AGENT,
    HTTP_TIMEOUT
  };
} )();
