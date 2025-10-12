/**
 * MusicBrainz API client module
 * @module services/musicbrainz
 */

const axios = require( 'axios' );

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';

/**
 * Fetches artist data from MusicBrainz API
 * @param {string} artistId - The MusicBrainz artist ID
 * @returns {Promise<object>} Artist data from MusicBrainz
 * @throws {Error} When the API request fails
 */
const fetchArtist = async ( artistId ) => {
  const url = `${MUSICBRAINZ_BASE_URL}/artist/${artistId}?inc=aliases+url-rels&fmt=json`;

  const response = await axios.get( url, {
    'headers': {
      'User-Agent': 'MusicFavorites/0.0.1 (https://github.com/b-uwe/musicFavorites)'
    },
    'timeout': 10000
  } );

  return response.data;
};

module.exports = {
  fetchArtist
};
