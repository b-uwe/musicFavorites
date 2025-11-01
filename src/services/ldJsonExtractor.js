( () => {
  'use strict';

  /**
   * LD+JSON extraction service
   * Extracts structured data from HTML pages
   * @module services/ldJsonExtractor
   */

  const axios = require( 'axios' );
  const cheerio = require( 'cheerio' );
  require( '../logger' );
  require( '../constants' );

  /**
   * Validates URL format for HTTP/HTTPS protocols with domain whitelist
   * @param {string} url - The URL to validate
   * @returns {boolean} True if valid HTTP/HTTPS URL with whitelisted domain, false otherwise
   */
  const validateUrl = ( url ) => {
    if ( typeof url !== 'string' ) {
      return false;
    }

    // Whitelist of allowed domains for fetching LD+JSON data
    const allowedDomains = [
      'bandsintown.com',
      'www.bandsintown.com'
    ];

    try {
      // Use globalThis.URL which is available in Node.js
      const urlObj = new globalThis.URL( url );

      // Only allow http and https protocols
      if ( urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:' ) {
        return false;
      }

      // Domain must be in whitelist
      if ( !allowedDomains.includes( urlObj.hostname ) ) {
        return false;
      }

      return true;
    } catch ( error ) {
      return false;
    }
  };

  /**
   * Extracts all LD+JSON blocks from HTML string
   * @param {string} html - The HTML content to parse
   * @returns {Array<object>} Array of parsed JSON objects
   */
  const extractLdJson = ( html ) => {
    if ( !html || html.length === 0 ) {
      return [];
    }

    const $ = cheerio.load( html );
    const ldJsonBlocks = [];

    $( 'script[type="application/ld+json"]' ).each( ( index, element ) => {
      try {
        const jsonText = $( element ).html();

        if ( jsonText ) {
          const parsed = JSON.parse( jsonText );

          // If parsed is an array, add each element separately (flatten)
          if ( Array.isArray( parsed ) ) {
            ldJsonBlocks.push( ...parsed );
          } else {
            ldJsonBlocks.push( parsed );
          }
        }
      } catch ( error ) {
        // Silently skip malformed JSON blocks
      }
    } );

    return ldJsonBlocks;
  };

  /**
   * Fetches a URL and extracts LD+JSON data
   * @param {string} url - The URL to fetch (must be valid HTTP/HTTPS URL)
   * @returns {Promise<Array<object>>} Array of parsed JSON objects (empty array on error or invalid URL)
   */
  const fetchAndExtractLdJson = async ( url ) => {
    if ( !validateUrl( url ) ) {
      return [];
    }

    // Log before request
    mf.logger.debug(
      { url },
      'Fetching Bandsintown HTML'
    );

    const start = Date.now();

    try {
      const response = await axios.get( url, {
        'timeout': mf.constants.HTTP_TIMEOUT,
        'headers': {
          'User-Agent': mf.constants.USER_AGENT
        }
      } );

      const events = extractLdJson( response.data );
      const duration = Date.now() - start;

      // Log successful parsing
      mf.logger.info(
        {
          url,
          'eventCount': events.length,
          duration
        },
        'Parsed Bandsintown events'
      );

      return events;
    } catch ( error ) {
      // Log warning on error
      mf.logger.warn(
        {
          url,
          'error': error.message
        },
        'Failed to extract LD+JSON'
      );

      // Fail silently for any errors (network, timeout, 404, etc.)
      return [];
    }
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.ldJsonExtractor = {
    fetchAndExtractLdJson
  };

  // Expose private functions for unit testing when running under Jest
  if ( process.env.JEST_WORKER_ID ) {
    globalThis.mf.testing = globalThis.mf.testing || {};
    globalThis.mf.testing.ldJsonExtractor = {
      extractLdJson
    };
  }
} )();
