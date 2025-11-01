( () => {
  'use strict';

  /**
   * MusicBrainz API client module
   * @module services/musicbrainz
   */

  const axios = require( 'axios' );
  require( '../logger' );
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
   * Logs successful MusicBrainz API response
   * @param {string} actId - The MusicBrainz act ID
   * @param {object} response - Axios response object
   * @param {number} duration - Request duration in milliseconds
   * @returns {void}
   */
  const logSuccess = ( actId, response, duration ) => {
    const logLevel = process.env.NODE_ENV === 'test' ? 'error' : 'info';

    mf.logger[ logLevel ](
      {
        actId,
        'status': response.status,
        duration,
        'dataSize': JSON.stringify( response.data ).length
      },
      'MusicBrainz fetch completed'
    );
  };

  /**
   * Logs MusicBrainz API error
   * @param {string} actId - The MusicBrainz act ID
   * @param {Error} error - Error object
   * @returns {void}
   */
  const logError = ( actId, error ) => {
    mf.logger.error(
      {
        actId,
        'error': error.message,
        'status': error.response?.status
      },
      'MusicBrainz API error'
    );
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

    mf.logger.debug(
      {
        actId,
        url
      },
      'Fetching from MusicBrainz'
    );

    const start = Date.now();

    try {
      const response = await axios.get( url, {
        'headers': {
          'User-Agent': mf.constants.USER_AGENT
        },
        'timeout': mf.constants.HTTP_TIMEOUT
      } );

      logSuccess( actId, response, Date.now() - start );

      return response.data;
    } catch ( error ) {
      logError( actId, error );
      throw new Error( `MusicBrainz: ${error.message}` );
    }
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.musicbrainz = {
    fetchAct
  };
} )();
