/**
 * MongoDB database administration and maintenance module
 * @module services/databaseAdmin
 */

( () => {
  'use strict';

  // Require database module for shared client access
  require( './database' );

  /**
   * Logs a data update error to the database
   * @param {object} errorData - Error information
   * @returns {Promise<void>} Resolves when error is logged
   * @throws {Error} When not connected, missing required fields, or write not acknowledged
   */
  const logUpdateError = async ( errorData ) => {
    if ( !errorData.timestamp || !errorData.actId || !errorData.errorMessage || !errorData.errorSource ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_017)' );
    }

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_016)' );
    }

    const collection = db.collection( 'dataUpdateErrors' );

    const result = await collection.insertOne( {
      'timestamp': errorData.timestamp,
      'actId': errorData.actId,
      'errorMessage': errorData.errorMessage,
      'errorSource': errorData.errorSource,
      'createdAt': new Date()
    } );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_018)' );
    }
  };

  /**
   * Gets all data update errors from the last 7 days
   * @returns {Promise<Array<object>>} Array of error objects sorted by timestamp descending
   * @throws {Error} When not connected to database
   */
  const getRecentUpdateErrors = async () => {
    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_019)' );
    }

    const collection = db.collection( 'dataUpdateErrors' );

    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate( sevenDaysAgo.getDate() - 7 );

    const results = await collection.find(
      {
        'createdAt': { '$gte': sevenDaysAgo }
      },
      {
        'projection': {
          '_id': 0,
          'timestamp': 1,
          'actId': 1,
          'errorMessage': 1,
          'errorSource': 1
        }
      }
    ).sort( {
      'createdAt': -1
    } ).toArray();

    return results;
  };

  /**
   * Ensures TTL index exists on dataUpdateErrors collection
   * @returns {Promise<void>} Resolves when index is created or already exists
   * @throws {Error} When not connected to database
   */
  const ensureErrorCollectionIndexes = async () => {
    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_020)' );
    }

    const collection = db.collection( 'dataUpdateErrors' );

    await collection.createIndex(
      { 'createdAt': 1 },
      { 'expireAfterSeconds': 604800 }
    );
  };

  /**
   * Clears all cached act data from the database
   * @returns {Promise<void>} Resolves when cache is cleared
   * @throws {Error} When not connected to database or delete not acknowledged
   */
  const clearCache = async () => {
    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_021)' );
    }

    const collection = db.collection( 'acts' );

    const result = await collection.deleteMany( {} );

    if ( !result.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_022)' );
    }
  };

  /**
   * Updates lastRequestedAt and resets updatesSinceLastRequest for requested acts
   * @param {Array<string>} actIds - Array of MusicBrainz act IDs
   * @returns {Promise<void>} Resolves when all acts are updated
   * @throws {Error} When not connected, actIds invalid, or update not acknowledged
   */
  const updateLastRequestedAt = async ( actIds ) => {
    if ( !Array.isArray( actIds ) || actIds.length === 0 ) {
      throw new Error( 'Invalid request. Please try again later. (Error: DB_024)' );
    }

    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_023)' );
    }

    require( './actService' );
    const metadataCollection = db.collection( 'actMetadata' );
    const timestamp = mf.actService.getBerlinTimestamp();

    for ( const actId of actIds ) {
      const result = await metadataCollection.updateOne(
        { '_id': actId },
        {
          '$set': {
            'lastRequestedAt': timestamp,
            'updatesSinceLastRequest': 0
          }
        },
        { 'upsert': true }
      );

      if ( !result.acknowledged ) {
        throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_025)' );
      }
    }
  };

  /**
   * Removes acts that have not been requested for 14 or more updates
   * @returns {Promise<object>} Object with deletedCount property
   * @throws {Error} When not connected or delete not acknowledged
   */
  const removeActsNotRequestedFor14Updates = async () => {
    let db;

    try {
      db = mf.database.getDatabase( 'musicfavorites' );
    } catch {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_026)' );
    }

    const staleMetadata = await db.collection( 'actMetadata' ).find( {
      'updatesSinceLastRequest': { '$gte': 14 }
    } ).toArray();

    if ( staleMetadata.length === 0 ) {
      return { 'deletedCount': 0 };
    }
    const idsToRemove = staleMetadata.map( ( doc ) => doc._id );
    const actsResult = await db.collection( 'acts' ).deleteMany( { '_id': { '$in': idsToRemove } } );

    if ( !actsResult.acknowledged ) {
      throw new Error( 'Service temporarily unavailable. Please try again later. (Error: DB_027)' );
    }
    await db.collection( 'actMetadata' ).deleteMany( { '_id': { '$in': idsToRemove } } );

    return { 'deletedCount': actsResult.deletedCount };
  };

  // Extend global namespace (mf is already initialized by database.js)
  globalThis.mf.databaseAdmin = {
    logUpdateError,
    getRecentUpdateErrors,
    ensureErrorCollectionIndexes,
    clearCache,
    updateLastRequestedAt,
    removeActsNotRequestedFor14Updates
  };
} )();
