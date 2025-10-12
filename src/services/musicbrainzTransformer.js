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
 * Transforms MusicBrainz artist data to our unified JSON format
 * @param {object} mbData - Raw MusicBrainz artist data
 * @returns {object} Transformed artist data
 */
const transformArtistData = ( mbData ) => {
  const relations = mbData.relations.
    map( processRelation ).
    filter( ( entry ) => entry !== null ).
    reduce( ( acc, { key, url } ) => {
      acc[ key ] = url;
      return acc;
    }, {} );

  const hasEndDate = Boolean( mbData[ 'life-span' ].end );
  const isMarkedEnded = Boolean( mbData[ 'life-span' ].ended );
  const ended = hasEndDate || isMarkedEnded;

  return {
    'musicbrainzId': mbData.id,
    'name': mbData.name,
    'country': mbData.area.name,
    'region': mbData[ 'begin-area' ].name,
    'disambiguation': mbData.disambiguation,
    ended,
    relations
  };
};

module.exports = {
  transformArtistData
};
