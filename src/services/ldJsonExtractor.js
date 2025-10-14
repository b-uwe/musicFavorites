/**
 * LD+JSON extraction service
 * Extracts structured data from HTML pages
 * @module services/ldJsonExtractor
 */

const axios = require( 'axios' );
const cheerio = require( 'cheerio' );
const { USER_AGENT, HTTP_TIMEOUT } = require( '../constants' );

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
 * @param {string} url - The URL to fetch
 * @returns {Promise<Array<object>>} Array of parsed JSON objects
 */
const fetchAndExtractLdJson = async ( url ) => {
  try {
    const response = await axios.get( url, {
      'timeout': HTTP_TIMEOUT,
      'headers': {
        'User-Agent': USER_AGENT
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
