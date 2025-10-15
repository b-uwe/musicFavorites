/**
 * Test utility for modifying fixture data
 * Allows creation of edge case test data based on real fixtures
 * @module testHelpers/fixtureModifier
 */

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
 * @param {string} path - Path to property (dot or bracket notation)
 * @param {*} value - Value to set (undefined to delete property)
 * @returns {void}
 */
const setNestedValue = ( obj, path, value ) => {
  const parts = path.
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

  Object.keys( modifications ).forEach( ( path ) => {
    setNestedValue( cloned, path, modifications[ path ] );
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

module.exports = {
  modifyFixture,
  modifyArrayItem
};
