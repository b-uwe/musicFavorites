( () => {
  'use strict';

  /**
   * Test utilities for loading and modifying fixture data
   * Provides helpers for integration tests to work with fixture files
   * @module testHelpers/fixtureHelpers
   */

  const fs = require( 'fs' );
  const path = require( 'path' );

  /**
   * Loads an HTML fixture file from the fixtures/ldjson directory
   * @param {string} filename - The fixture filename (e.g., 'bandsintown-vulvodynia.html')
   * @returns {string} File contents as UTF-8 string
   */
  const loadFixture = ( filename ) => {
    const fixturePath = path.join( __dirname, '../__tests__/fixtures/ldjson', filename );

    return fs.readFileSync( fixturePath, 'utf8' );
  };

  /**
   * Deep clones an object to prevent mutation
   * @param {*} obj - Object to clone
   * @returns {*} Deep cloned object
   */
  const deepClone = ( obj ) => {
    if ( obj === null || typeof obj !== 'object' ) {
      return obj;
    }

    if ( Array.isArray( obj ) ) {
      return obj.map( ( item ) => deepClone( item ) );
    }

    const cloned = {};

    Object.keys( obj ).forEach( ( key ) => {
      cloned[ key ] = deepClone( obj[ key ] );
    } );

    return cloned;
  };

  /**
   * Sets a value at a nested path in an object
   * Supports dot notation (e.g., "location.address.city")
   * Supports bracket notation for arrays (e.g., "events[0].name")
   * @param {object} obj - Object to modify
   * @param {string} propertyPath - Path to property (dot or bracket notation)
   * @param {*} value - Value to set (undefined to delete property)
   * @returns {void}
   */
  const setNestedValue = ( obj, propertyPath, value ) => {
    const parts = propertyPath.
      split( /\.|\[/u ).
      map( ( part ) => part.replace( /\]/gu, '' ) );

    let current = obj;

    for ( let idx = 0; idx < parts.length - 1; idx += 1 ) {
      const part = parts[ idx ];

      if ( !Object.prototype.hasOwnProperty.call( current, part ) ) {
        current[ part ] = {};
      }
      current = current[ part ];
    }

    const lastPart = parts[ parts.length - 1 ];

    if ( typeof value === 'undefined' ) {
      delete current[ lastPart ];
    } else {
      current[ lastPart ] = value;
    }
  };

  /**
   * Modifies a fixture object with specified changes
   * Creates a deep copy to prevent mutation of original fixture
   * @param {object} fixture - Original fixture data
   * @param {object} modifications - Object with paths as keys and new values
   * @returns {object} Modified copy of fixture
   */
  const modifyFixture = ( fixture, modifications ) => {
    const cloned = deepClone( fixture );

    Object.keys( modifications ).forEach( ( propertyPath ) => {
      setNestedValue( cloned, propertyPath, modifications[ propertyPath ] );
    } );

    return cloned;
  };

  /**
   * Modifies a specific item in an array fixture
   * Creates a deep copy to prevent mutation of original array
   * @param {Array<object>} arrayFixture - Original array fixture
   * @param {number} index - Index of item to modify
   * @param {object} modifications - Object with paths as keys and new values
   * @returns {Array<object>} Modified copy of array fixture
   */
  const modifyArrayItem = ( arrayFixture, index, modifications ) => {
    if ( index < 0 ) {
      throw new Error( 'Index must be non-negative' );
    }

    if ( index >= arrayFixture.length ) {
      throw new Error( `Index ${index} out of bounds for array of length ${arrayFixture.length}` );
    }

    const clonedArray = deepClone( arrayFixture );

    clonedArray[ index ] = modifyFixture( clonedArray[ index ], modifications );

    return clonedArray;
  };

  /**
   * Converts an ISO date string to a future date
   * @param {string} dateStr - ISO date string to convert
   * @param {number} daysInFuture - Number of days in the future
   * @returns {string} Converted ISO date string
   */
  const convertToFutureDate = ( dateStr, daysInFuture ) => {
    const futureDate = new Date();

    futureDate.setUTCDate( futureDate.getUTCDate() + daysInFuture );
    futureDate.setUTCHours( 0, 0, 0, 0 );

    const [ futureDateStr ] = futureDate.toISOString().split( 'T' );

    // Preserve time component if original had one
    if ( dateStr.includes( 'T' ) ) {
      /*
       * Extract time component from original string (after the T)
       * This will always match because dateStr passed the ISO pattern check
       */
      const timeMatch = dateStr.match( /T(?<time>\d{2}:\d{2}:\d{2})/u );
      const timeComponent = timeMatch.groups.time;

      // Preserve whether original had Z suffix
      const zSuffix = dateStr.endsWith( 'Z' ) ? 'Z' : '';

      return `${futureDateStr}T${timeComponent}${zSuffix}`;
    }

    // Date only (YYYY-MM-DD)
    return futureDateStr;
  };

  /**
   * Normalizes dates in fixture data to be in the future
   * Finds ISO date-time strings and replaces them with future dates
   * @param {object|Array} fixture - Fixture data to normalize
   * @param {number} daysInFuture - Number of days in the future (default: 7)
   * @returns {object|Array} Fixture with normalized dates
   */
  const normalizeDates = ( fixture, daysInFuture = 7 ) => {
    const cloned = deepClone( fixture );

    // Pattern to match ISO date-time strings (YYYY-MM-DD and optional THH:MM:SS)
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?Z?$/u;

    /**
     * Recursively replaces date strings with future dates
     * @param {*} obj - Object to process
     * @returns {*} Processed object with replaced dates
     */
    const replaceDates = ( obj ) => {
      if ( typeof obj === 'string' && isoDatePattern.test( obj ) ) {
        return convertToFutureDate( obj, daysInFuture );
      }

      if ( Array.isArray( obj ) ) {
        return obj.map( ( item ) => replaceDates( item ) );
      }

      if ( obj !== null && typeof obj === 'object' ) {
        const processed = {};

        Object.keys( obj ).forEach( ( key ) => {
          processed[ key ] = replaceDates( obj[ key ] );
        } );

        return processed;
      }

      return obj;
    };

    return replaceDates( cloned );
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.testing = globalThis.mf.testing || {};
  globalThis.mf.testing.fixtureHelpers = {
    loadFixture,
    modifyFixture,
    modifyArrayItem,
    normalizeDates
  };
} )();
