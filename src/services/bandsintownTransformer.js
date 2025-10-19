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
  if ( !location?.geo ) {
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
  'name': event.name || '',
  'date': extractDate( event.startDate ),
  'localTime': extractLocalTime( event.startDate ),
  'location': {
    'address': buildAddress( event.location?.address ),
    'geo': extractGeo( event.location )
  }
} );

/**
 * Checks if an event date is within the allowed range (2 days ago or newer in UTC)
 * @param {string} startDate - ISO 8601 datetime string
 * @returns {boolean} True if event is within range, false otherwise
 */
const isEventWithinRange = ( startDate ) => {
  if ( !startDate || typeof startDate !== 'string' ) {
    return false;
  }

  const eventDate = new Date( startDate );

  if ( isNaN( eventDate.getTime() ) ) {
    return false;
  }

  const cutoffDate = new Date();

  cutoffDate.setUTCHours( 0, 0, 0, 0 );
  cutoffDate.setUTCDate( cutoffDate.getUTCDate() - 2 );

  const eventUtcMidnight = new Date( eventDate );

  eventUtcMidnight.setUTCHours( 0, 0, 0, 0 );

  return eventUtcMidnight >= cutoffDate;
};

/**
 * Transforms array of LD+JSON objects to event schema
 * Filters to include only MusicEvent type objects
 * Filters out events older than 2 calendar days (UTC)
 * @param {Array<object>} ldJsonData - Array of LD+JSON objects
 * @returns {Array<object>} Array of transformed event objects
 */
const transformEvents = ( ldJsonData ) => {
  if ( !ldJsonData || !Array.isArray( ldJsonData ) ) {
    return [];
  }

  return ldJsonData.
    filter( ( item ) => item[ '@type' ] === 'MusicEvent' ).
    filter( ( item ) => isEventWithinRange( item.startDate ) ).
    map( transformEvent );
};

module.exports = {
  transformEvents,
  // Exported for testing defensive guard clauses
  extractDate,
  extractLocalTime
};
