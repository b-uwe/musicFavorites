( () => {
  'use strict';

  /**
   * MusicBrainz API client module
   * @module services/musicbrainz
   */

  const axios = require( 'axios' );
  require( '../constants' );

  const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';

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
   * Fetches act data from MusicBrainz API
   * @param {string} actId - The MusicBrainz act ID (must be a valid UUID)
   * @returns {Promise<object>} Act data from MusicBrainz
   * @throws {Error} When the API request fails or MBID is invalid (with MusicBrainz prefix)
   */
  const fetchAct = async ( actId ) => {
    if ( !validateMbid( actId ) ) {
      throw new Error( 'MusicBrainz: Invalid MBID format' );
    }

    const url = `${MUSICBRAINZ_BASE_URL}/artist/${actId}?inc=aliases+url-rels&fmt=json`;

    try {
      const response = await axios.get( url, {
        'headers': {
          'User-Agent': mf.constants.USER_AGENT
        },
        'timeout': mf.constants.HTTP_TIMEOUT
      } );

      return response.data;
    } catch ( error ) {
      throw new Error( `MusicBrainz: ${error.message}` );
    }
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.musicbrainz = {
    fetchAct
  };
} )();
