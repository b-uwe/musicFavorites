/**
 * Tests for MusicBrainz data transformer
 */

const transformer = require( '../../../services/musicbrainzTransformer' );
const fixtureModifier = require( '../../../testHelpers/fixtureModifier' );
const fixtureJungleRot = require( '../../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../../fixtures/musicbrainz-the-kinks.json' );

describe( 'MusicBrainz Data Transformer', () => {
  describe( 'transformArtistData', () => {
    let resultJungleRot;
    let resultTheKinks;

    beforeAll( () => {
      resultJungleRot = transformer.transformArtistData( fixtureJungleRot );
      resultTheKinks = transformer.transformArtistData( fixtureTheKinks );
    } );

    /**
     * Test basic artist metadata transformation for active band
     */
    test( 'transforms basic artist metadata correctly for active band', () => {
      expect( resultJungleRot._id ).toBe( 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317' );
      expect( resultJungleRot.name ).toBe( 'Jungle Rot' );
      expect( resultJungleRot.country ).toBe( 'United States' );
      expect( resultJungleRot.region ).toBe( 'Wisconsin' );
      expect( resultJungleRot.disambiguation ).toBe( 'United States death metal' );
      expect( resultJungleRot.status ).toBe( 'active' );
    } );

    /**
     * Test basic artist metadata transformation for disbanded band
     */
    test( 'transforms basic artist metadata correctly for disbanded band', () => {
      const result = resultTheKinks;

      expect( result._id ).toBe( '17b53d9f-5c63-4a09-a593-dde4608e0db9' );
      expect( result.name ).toBe( 'The Kinks' );
      expect( result.country ).toBe( 'United Kingdom' );
      expect( result.region ).toBe( 'London' );
      expect( result.status ).toBe( 'disbanded' );
    } );

    /**
     * Test relations object structure
     */
    test( 'includes relations object', () => {
      expect( resultJungleRot.relations ).toBeDefined();
      expect( typeof resultJungleRot.relations ).toBe( 'object' );
    } );

    /**
     * Test included relation types
     */
    test( 'includes allmusic relation', () => {
      expect( resultJungleRot.relations.allmusic ).toBe( 'https://www.allmusic.com/artist/mn0000310088' );
    } );

    /**
     * Test bandcamp inclusion
     */
    test( 'includes bandcamp relation', () => {
      expect( resultJungleRot.relations.bandcamp ).toBe( 'https://junglerot.bandcamp.com/' );
    } );

    /**
     * Test bandsintown inclusion
     */
    test( 'includes bandsintown relation', () => {
      expect( resultJungleRot.relations.bandsintown ).toBe( 'https://www.bandsintown.com/a/13217' );
    } );

    /**
     * Test discogs inclusion
     */
    test( 'includes discogs relation', () => {
      expect( resultJungleRot.relations.discogs ).toBe( 'https://www.discogs.com/artist/606841' );
    } );

    /**
     * Test lastfm inclusion
     */
    test( 'includes lastfm relation', () => {
      expect( resultJungleRot.relations.lastfm ).toBe( 'https://www.last.fm/music/Jungle+Rot' );
    } );

    /**
     * Test lyrics site inclusion
     */
    test( 'includes lyrics relation', () => {
      expect( resultJungleRot.relations.lyrics ).toBe( 'https://genius.com/artists/Jungle-rot' );
    } );

    /**
     * Test myspace inclusion
     */
    test( 'includes myspace relation', () => {
      expect( resultJungleRot.relations.myspace ).toBe( 'https://myspace.com/junglerot' );
    } );

    /**
     * Test setlistfm inclusion
     */
    test( 'includes setlistfm relation', () => {
      expect( resultJungleRot.relations.setlistfm ).toBe( 'https://www.setlist.fm/setlists/jungle-rot-5bd43f8c.html' );
    } );

    /**
     * Test songkick inclusion
     */
    test( 'includes songkick relation', () => {
      expect( resultJungleRot.relations.songkick ).toBe( 'https://www.songkick.com/artists/478835' );
    } );

    /**
     * Test soundcloud inclusion
     */
    test( 'includes soundcloud relation', () => {
      expect( resultJungleRot.relations.soundcloud ).toBe( 'https://soundcloud.com/jungle-rot' );
    } );

    /**
     * Test VIAF inclusion
     */
    test( 'includes viaf relation', () => {
      expect( resultJungleRot.relations.viaf ).toBe( 'http://viaf.org/viaf/123957878' );
    } );

    /**
     * Test wikidata inclusion
     */
    test( 'includes wikidata relation', () => {
      expect( resultJungleRot.relations.wikidata ).toBe( 'https://www.wikidata.org/wiki/Q743790' );
    } );

    /**
     * Test YouTube inclusion
     */
    test( 'includes youtube relation', () => {
      expect( resultJungleRot.relations.youtube ).toBeDefined();
      expect( typeof resultJungleRot.relations.youtube ).toBe( 'string' );
      expect( resultJungleRot.relations.youtube ).toMatch( /youtube\.com/u );
    } );

    /**
     * Test YouTube Music inclusion
     */
    test( 'includes youtubeMusic relation', () => {
      expect( resultJungleRot.relations.youtubemusic ).toBe( 'https://music.youtube.com/channel/UCxYpK12nORvztF7A7kvCdCQ' );
    } );

    /**
     * Test Twitter extraction from social networks
     */
    test( 'extracts twitter from social network relations', () => {
      expect( resultJungleRot.relations.twitter ).toBe( 'https://twitter.com/JungleRotBand' );
    } );

    /**
     * Test Facebook extraction from social networks
     */
    test( 'extracts facebook from social network relations', () => {
      expect( resultJungleRot.relations.facebook ).toBe( 'https://www.facebook.com/igotjunglerot' );
    } );

    /**
     * Test Instagram extraction from social networks
     */
    test( 'extracts instagram from social network relations', () => {
      expect( resultJungleRot.relations.instagram ).toBe( 'https://www.instagram.com/jungle_rot/' );
    } );

    /**
     * Test TikTok extraction from social networks
     */
    test( 'extracts tiktok from social network relations', () => {
      expect( resultJungleRot.relations.tiktok ).toBe( 'https://www.tiktok.com/@jungle_rot' );
    } );

    /**
     * Test exclusion of free streaming services
     */
    test( 'excludes free streaming services', () => {
      expect( resultJungleRot.relations.spotify ).toBeUndefined();
      expect( resultJungleRot.relations.deezer ).toBeUndefined();
    } );

    /**
     * Test exclusion of paid streaming services
     */
    test( 'excludes paid streaming services', () => {
      expect( resultJungleRot.relations.amazonMusic ).toBeUndefined();
      expect( resultJungleRot.relations.appleMusic ).toBeUndefined();
      expect( resultJungleRot.relations.tidal ).toBeUndefined();
      expect( resultJungleRot.relations.napster ).toBeUndefined();
    } );

    /**
     * Test exclusion of purchase for download
     */
    test( 'excludes purchase for download services', () => {
      expect( resultJungleRot.relations.itunes ).toBeUndefined();
    } );

    /**
     * Test exclusion of other databases
     */
    test( 'excludes other database relations', () => {
      expect( resultJungleRot.relations.rateyourmusic ).toBeUndefined();
      expect( resultJungleRot.relations.metalArchives ).toBeUndefined();
      expect( resultJungleRot.relations.musikSammler ).toBeUndefined();
      expect( resultJungleRot.relations.spiritOfMetal ).toBeUndefined();
    } );

    /**
     * Test exclusion of non-major social networks
     */
    test( 'excludes reverbnation from social networks', () => {
      expect( resultJungleRot.relations.reverbnation ).toBeUndefined();
    } );

    /**
     * Test YouTube Music inclusion
     */
    test( 'handles multiple youtube relations', () => {
      // When multiple youtube relations exist, the last one processed is kept
      expect( resultJungleRot.relations.youtube ).toBeDefined();
      expect( resultJungleRot.relations.youtube ).toContain( 'youtube.com' );
    } );

    /**
     * Test null-safety for missing relation.url
     */
    test( 'handles null relation gracefully', () => {
      const dataWithNullRelation = fixtureModifier.modifyFixture( fixtureJungleRot, {
        'relations': [
          null,
          { 'type': 'bandcamp',
            'url': null },
          { 'type': 'bandcamp',
            'url': { 'resource': null } }
        ]
      } );

      const result = transformer.transformArtistData( dataWithNullRelation );

      expect( result.relations ).toEqual( {} );
    } );

    /**
     * Test null-safety for missing artist metadata
     */
    test( 'handles missing artist metadata gracefully', () => {
      const dataWithMissingFields = fixtureModifier.modifyFixture( fixtureJungleRot, {
        'relations': undefined,
        'area': null,
        'begin-area': null,
        'disambiguation': null,
        'life-span': null
      } );

      const result = transformer.transformArtistData( dataWithMissingFields );

      expect( result.country ).toBeNull();
      expect( result.region ).toBeNull();
      expect( result.disambiguation ).toBe( '' );
      expect( result.status ).toBe( 'active' );
      expect( result.relations ).toEqual( {} );
    } );
  } );
} );
