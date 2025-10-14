/**
 * LD+JSON extraction service
 * Extracts structured data from HTML pages
 * @module services/ldJsonExtractor
 */

const axios = require( 'axios' );
const cheerio = require( 'cheerio' );

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

        ldJsonBlocks.push( parsed );
      }
    } catch ( error ) {
      // Silently skip malformed JSON blocks
    }
  } );

  return ldJsonBlocks;
};

/**
 * Fetches a URL and extracts LD+JSON data
 * @param {string} url - The URL to fetch
 * @returns {Promise<Array<object>>} Array of parsed JSON objects
 */
const fetchAndExtractLdJson = async ( url ) => {
  try {
    const response = await axios.get( url, {
      'timeout': 10000,
      'headers': {
        'User-Agent': 'Mozilla/5.0 (compatible; MusicFavoritesBot/0.0.1)'
      }
    } );

    return extractLdJson( response.data );
  } catch ( error ) {
    // Fail silently for any errors (network, timeout, 404, etc.)
    return [];
  }
};

module.exports = {
  extractLdJson,
  fetchAndExtractLdJson
};
