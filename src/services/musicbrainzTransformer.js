( () => {
  'use strict';

  /**
   * MusicBrainz data transformer module
   * @module services/musicbrainzTransformer
   */

  /**
   * Detects social media platform from URL
   * @param {string} url - The URL to check
   * @returns {string|null} Platform name or null if not a major social platform
   */
  const detectSocialPlatform = ( url ) => {
    const match = url.match( /(?:twitter|facebook|instagram|tiktok)\.com/u );
    if ( !match ) {
      return null;
    }
    return match[ 0 ].split( '.' )[ 0 ];
  };

  const EXCLUDED_TYPES = [ 'free streaming', 'streaming', 'purchase for download', 'other databases' ];

  /**
   * Processes a single relation and returns key-value pair for relations object
   * @param {object} relation - A MusicBrainz relation object
   * @returns {object|null} Object with key and url properties, or null if excluded
   */
  const processRelation = ( relation ) => {
    if ( !relation?.url?.resource ) {
      return null;
    }

    const { type } = relation;
    const url = relation.url.resource;

    if ( EXCLUDED_TYPES.includes( type ) ) {
      return null;
    }

    if ( type === 'social network' ) {
      const platform = detectSocialPlatform( url );
      if ( platform ) {
        return {
          'key': platform,
          url
        };
      }
      return null;
    }

    const key = type.toLowerCase().replace( /[ .]/gu, '' );
    return {
      key,
      url
    };
  };

  /**
   * Transforms MusicBrainz act data to our unified JSON format
   * @param {object} mbData - Raw MusicBrainz act data
   * @returns {object} Transformed act data
   */
  const transformActData = ( mbData ) => {
    const relations = ( mbData.relations || [] ).
      map( processRelation ).
      filter( ( entry ) => entry !== null ).
      reduce( ( acc, { key, url } ) => {
        acc[ key ] = url;
        return acc;
      }, {} );

    const lifeSpan = mbData[ 'life-span' ] || {};
    const hasEndDate = Boolean( lifeSpan.end );
    const isMarkedEnded = Boolean( lifeSpan.ended );
    const isEnded = hasEndDate || isMarkedEnded;
    const status = isEnded ? 'disbanded' : 'active';

    return {
      '_id': mbData.id,
      'name': mbData.name,
      'country': mbData.area?.name ?? null,
      'region': mbData[ 'begin-area' ]?.name ?? null,
      'disambiguation': mbData.disambiguation || '',
      status,
      relations
    };
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.musicbrainzTransformer = {
    transformActData
  };
} )();
