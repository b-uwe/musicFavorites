/**
 * Tests for MusicBrainz data transformer
 */

const transformer = require( '../../services/musicbrainzTransformer' );
const fixtureJungleRot = require( '../fixtures/musicbrainz-jungle-rot.json' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );

describe( 'MusicBrainz Data Transformer', () => {
  describe( 'transformArtistData', () => {
    /**
     * Test basic artist metadata transformation for active band
     */
    test( 'transforms basic artist metadata correctly for active band', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.musicbrainzId ).toBe( 'ab81255c-7a4f-4528-bb77-4a3fbd8e8317' );
      expect( result.name ).toBe( 'Jungle Rot' );
      expect( result.country ).toBe( 'United States' );
      expect( result.region ).toBe( 'Wisconsin' );
      expect( result.disambiguation ).toBe( 'United States death metal' );
      expect( result.ended ).toBe( false );
    } );

    /**
     * Test basic artist metadata transformation for ended band
     */
    test( 'transforms basic artist metadata correctly for ended band', () => {
      const result = transformer.transformArtistData( fixtureTheKinks );

      expect( result.musicbrainzId ).toBe( '17b53d9f-5c63-4a09-a593-dde4608e0db9' );
      expect( result.name ).toBe( 'The Kinks' );
      expect( result.country ).toBe( 'United Kingdom' );
      expect( result.region ).toBe( 'London' );
      expect( result.ended ).toBe( true );
    } );

    /**
     * Test relations object structure
     */
    test( 'includes relations object', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations ).toBeDefined();
      expect( typeof result.relations ).toBe( 'object' );
    } );

    /**
     * Test included relation types
     */
    test( 'includes allmusic relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.allmusic ).toBe( 'https://www.allmusic.com/artist/mn0000310088' );
    } );

    /**
     * Test bandcamp inclusion
     */
    test( 'includes bandcamp relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.bandcamp ).toBe( 'https://junglerot.bandcamp.com/' );
    } );

    /**
     * Test bandsintown inclusion
     */
    test( 'includes bandsintown relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.bandsintown ).toBe( 'https://www.bandsintown.com/a/13217' );
    } );

    /**
     * Test discogs inclusion
     */
    test( 'includes discogs relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.discogs ).toBe( 'https://www.discogs.com/artist/606841' );
    } );

    /**
     * Test lastfm inclusion
     */
    test( 'includes lastfm relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.lastfm ).toBe( 'https://www.last.fm/music/Jungle+Rot' );
    } );

    /**
     * Test lyrics site inclusion
     */
    test( 'includes lyrics relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.lyrics ).toBe( 'https://genius.com/artists/Jungle-rot' );
    } );

    /**
     * Test myspace inclusion
     */
    test( 'includes myspace relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.myspace ).toBe( 'https://myspace.com/junglerot' );
    } );

    /**
     * Test setlistfm inclusion
     */
    test( 'includes setlistfm relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.setlistfm ).toBe( 'https://www.setlist.fm/setlists/jungle-rot-5bd43f8c.html' );
    } );

    /**
     * Test songkick inclusion
     */
    test( 'includes songkick relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.songkick ).toBe( 'https://www.songkick.com/artists/478835' );
    } );

    /**
     * Test soundcloud inclusion
     */
    test( 'includes soundcloud relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.soundcloud ).toBe( 'https://soundcloud.com/jungle-rot' );
    } );

    /**
     * Test VIAF inclusion
     */
    test( 'includes viaf relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.viaf ).toBe( 'http://viaf.org/viaf/123957878' );
    } );

    /**
     * Test wikidata inclusion
     */
    test( 'includes wikidata relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.wikidata ).toBe( 'https://www.wikidata.org/wiki/Q743790' );
    } );

    /**
     * Test YouTube inclusion
     */
    test( 'includes youtube relation for non-ended channels', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.youtube ).toBe( 'https://www.youtube.com/junglerotmusic' );
    } );

    /**
     * Test YouTube Music inclusion
     */
    test( 'includes youtubeMusic relation', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.youtubeMusic ).toBe( 'https://music.youtube.com/channel/UCxYpK12nORvztF7A7kvCdCQ' );
    } );

    /**
     * Test Twitter extraction from social networks
     */
    test( 'extracts twitter from social network relations', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.twitter ).toBe( 'https://twitter.com/JungleRotBand' );
    } );

    /**
     * Test Facebook extraction from social networks
     */
    test( 'extracts facebook from social network relations', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.facebook ).toBe( 'https://www.facebook.com/igotjunglerot' );
    } );

    /**
     * Test Instagram extraction from social networks
     */
    test( 'extracts instagram from social network relations', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.instagram ).toBe( 'https://www.instagram.com/jungle_rot/' );
    } );

    /**
     * Test TikTok extraction from social networks
     */
    test( 'extracts tiktok from social network relations', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.tiktok ).toBe( 'https://www.tiktok.com/@jungle_rot' );
    } );

    /**
     * Test exclusion of free streaming services
     */
    test( 'excludes free streaming services', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.spotify ).toBeUndefined();
      expect( result.relations.deezer ).toBeUndefined();
    } );

    /**
     * Test exclusion of paid streaming services
     */
    test( 'excludes paid streaming services', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.amazonMusic ).toBeUndefined();
      expect( result.relations.appleMusic ).toBeUndefined();
      expect( result.relations.tidal ).toBeUndefined();
      expect( result.relations.napster ).toBeUndefined();
    } );

    /**
     * Test exclusion of purchase for download
     */
    test( 'excludes purchase for download services', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.itunes ).toBeUndefined();
    } );

    /**
     * Test exclusion of other databases
     */
    test( 'excludes other database relations', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.rateyourmusic ).toBeUndefined();
      expect( result.relations.metalArchives ).toBeUndefined();
      expect( result.relations.musikSammler ).toBeUndefined();
      expect( result.relations.spiritOfMetal ).toBeUndefined();
    } );

    /**
     * Test exclusion of non-major social networks
     */
    test( 'excludes reverbnation from social networks', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );

      expect( result.relations.reverbnation ).toBeUndefined();
    } );

    /**
     * Test handling of ended YouTube channels
     */
    test( 'excludes ended youtube channels', () => {
      const result = transformer.transformArtistData( fixtureJungleRot );
      const { youtube } = result.relations;

      expect( youtube ).not.toBe( 'https://www.youtube.com/channel/UCuqunF0lmMsOFcb-RqOe0Yw' );
    } );

  } );
} );
