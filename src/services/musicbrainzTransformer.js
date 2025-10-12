/**
 * MusicBrainz data transformer module
 * @module services/musicbrainzTransformer
 */

/**
 * Maps social network URLs to their platform names
 * @param {string} url - The social network URL
 * @returns {string|null} Platform name or null if not supported
 */
const getSocialPlatform = ( url ) => {
  if ( url.includes( 'twitter.com' ) ) {
    return 'twitter';
  }
  if ( url.includes( 'facebook.com' ) ) {
    return 'facebook';
  }
  if ( url.includes( 'instagram.com' ) ) {
    return 'instagram';
  }
  if ( url.includes( 'tiktok.com' ) ) {
    return 'tiktok';
  }
  return null;
};

/**
 * Processes a single relation and adds it to the relations object
 * @param {object} relation - A MusicBrainz relation object
 * @param {object} relations - The relations object to populate
 * @returns {void}
 */
const processRelation = ( relation, relations ) => {
  const { type } = relation;
  const url = relation.url.resource;
  const typeMap = {
    'allmusic': 'allmusic',
    'bandcamp': 'bandcamp',
    'bandsintown': 'bandsintown',
    'discogs': 'discogs',
    'last.fm': 'lastfm',
    'lyrics': 'lyrics',
    'myspace': 'myspace',
    'setlistfm': 'setlistfm',
    'songkick': 'songkick',
    'soundcloud': 'soundcloud',
    'VIAF': 'viaf',
    'wikidata': 'wikidata',
    'youtube music': 'youtubeMusic'
  };

  if ( typeMap[ type ] ) {
    relations[ typeMap[ type ] ] = url;
  }

  if ( type === 'youtube' ) {
    if ( !relation.ended ) {
      relations.youtube = url;
    }
  }

  if ( type === 'social network' ) {
    const platform = getSocialPlatform( url );
    if ( platform ) {
      relations[ platform ] = url;
    }
  }
};

/**
 * Transforms MusicBrainz artist data to our unified JSON format
 * @param {object} mbData - Raw MusicBrainz artist data
 * @returns {object} Transformed artist data
 */
const transformArtistData = ( mbData ) => {
  const relations = {};

  mbData.relations.forEach( ( relation ) => {
    processRelation( relation, relations );
  } );

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
