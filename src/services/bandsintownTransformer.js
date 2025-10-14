/**
 * Bandsintown event transformer module
 * Transforms LD+JSON MusicEvent data to unified event schema
 * @module services/bandsintownTransformer
 */

/**
 * Extracts date from ISO 8601 datetime string
 * @param {string} startDate - ISO 8601 datetime string (e.g., "2025-11-25T18:00:00")
 * @returns {string} Date in YYYY-MM-DD format, or empty string if invalid
 */
const extractDate = ( startDate ) => {
  if ( !startDate || typeof startDate !== 'string' ) {
    return '';
  }

  const match = startDate.match( /^(?<date>\d{4}-\d{2}-\d{2})/u );

  return match ? match.groups.date : '';
};

/**
 * Extracts local time from ISO 8601 datetime string
 * @param {string} startDate - ISO 8601 datetime string (e.g., "2025-11-25T18:00:00")
 * @returns {string} Time in HH:MM:SS format, or empty string if invalid/missing
 */
const extractLocalTime = ( startDate ) => {
  if ( !startDate || typeof startDate !== 'string' ) {
    return '';
  }

  const match = startDate.match( /T(?<time>\d{2}:\d{2}:\d{2})/u );

  return match ? match.groups.time : '';
};

/**
 * Builds address string from PostalAddress components
 * @param {object} address - PostalAddress schema.org object
 * @returns {string|null} Concatenated address or null if no address
 */
const buildAddress = ( address ) => {
  if ( !address ) {
    return null;
  }

  const parts = [
    address.streetAddress,
    address.postalCode,
    address.addressLocality,
    address.addressCountry
  ].filter( ( part ) => part );

  return parts.length > 0 ? parts.join( ', ' ) : null;
};

/**
 * Extracts geo coordinates from location
 * @param {object} location - Place schema.org object
 * @returns {object|null} Object with lat and lon, or null if no geo data
 */
const extractGeo = ( location ) => {
  if ( !location || !location.geo ) {
    return null;
  }

  const { latitude, longitude } = location.geo;

  if ( typeof latitude !== 'number' || typeof longitude !== 'number' ) {
    return null;
  }

  return {
    'lat': latitude,
    'lon': longitude
  };
};

/**
 * Transforms a single MusicEvent to our event schema
 * @param {object} event - LD+JSON MusicEvent object
 * @returns {object} Transformed event object
 */
const transformEvent = ( event ) => ( {
  'name': event.name,
  'date': extractDate( event.startDate ),
  'localTime': extractLocalTime( event.startDate ),
  'location': {
    'address': buildAddress( event.location?.address ),
    'geo': extractGeo( event.location )
  }
} );

/**
 * Transforms array of LD+JSON objects to event schema
 * Filters to include only MusicEvent type objects
 * @param {Array<object>} ldJsonData - Array of LD+JSON objects
 * @returns {Array<object>} Array of transformed event objects
 */
const transformEvents = ( ldJsonData ) => {
  if ( !ldJsonData || !Array.isArray( ldJsonData ) ) {
    return [];
  }

  return ldJsonData.
    filter( ( item ) => item[ '@type' ] === 'MusicEvent' ).
    map( transformEvent );
};

module.exports = {
  transformEvents
};
