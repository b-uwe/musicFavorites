( () => {
  'use strict';

  /**
   * Input validation module for backend service calls
   * @module services/inputValidator
   */

  /**
   * Validates MusicBrainz ID (MBID) format
   * MBIDs are UUIDs in the format: 8-4-4-4-12 hex digits
   * @param {string} mbid - The MusicBrainz ID to validate
   * @returns {boolean} True if valid MBID format, false otherwise
   */
  const validateMbid = ( mbid ) => {
    if ( typeof mbid !== 'string' ) {
      return false;
    }

    const mbidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/ui;

    return mbidRegex.test( mbid );
  };

  /**
   * Validates URL format for HTTP/HTTPS protocols
   * @param {string} url - The URL to validate
   * @returns {boolean} True if valid HTTP/HTTPS URL, false otherwise
   */
  const validateUrl = ( url ) => {
    if ( typeof url !== 'string' ) {
      return false;
    }

    try {
      // Use globalThis.URL which is available in Node.js
      const urlObj = new globalThis.URL( url );

      // Only allow http and https protocols
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch ( error ) {
      return false;
    }
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.inputValidator = {
    validateMbid,
    validateUrl
  };
} )();
