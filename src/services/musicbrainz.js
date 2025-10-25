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
   * Fetches artist data from MusicBrainz API
   * @param {string} artistId - The MusicBrainz artist ID
   * @returns {Promise<object>} Artist data from MusicBrainz
   * @throws {Error} When the API request fails (with MusicBrainz prefix)
   */
  const fetchArtist = async ( artistId ) => {
    const url = `${MUSICBRAINZ_BASE_URL}/artist/${artistId}?inc=aliases+url-rels&fmt=json`;

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
    fetchArtist
  };
} )();
