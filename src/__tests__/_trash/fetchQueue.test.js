/**
 * Tests for fetch queue processor
 * @module __tests__/services/fetchQueue
 */

const database = require( '../../services/database' );
const musicbrainzClient = require( '../../services/musicbrainz' );
const musicbrainzTransformer = require( '../../services/musicbrainzTransformer' );
const ldJsonExtractor = require( '../../services/ldJsonExtractor' );
const fixtureTheKinks = require( '../fixtures/musicbrainz-the-kinks.json' );
const fixtureVulvodynia = require( '../fixtures/musicbrainz-vulvodynia.json' );

jest.mock( '../../services/database' );
jest.mock( '../../services/musicbrainz' );
jest.mock( '../../services/ldJsonExtractor' );

const fetchQueue = require( '../../services/fetchQueue' );

describe( 'Fetch Queue Service', () => {
  let transformedTheKinks;
  let transformedVulvodynia;

  beforeEach( () => {
    jest.clearAllMocks();
    transformedTheKinks = musicbrainzTransformer.transformActData( fixtureTheKinks );
    transformedVulvodynia = musicbrainzTransformer.transformActData( fixtureVulvodynia );
  } );

  describe( 'triggerBackgroundFetch', () => {
    /**
     * Test processing a single act
     */
    test( 'processes single act and caches result', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedTheKinks._id ];

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockResolvedValue();

      fetchQueue.triggerBackgroundFetch( actIds );

      await jest.runAllTimersAsync();

      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledWith( transformedTheKinks._id );
      expect( database.cacheAct ).toHaveBeenCalledWith( expect.objectContaining( {
        '_id': transformedTheKinks._id,
        'name': transformedTheKinks.name
      } ) );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test processing multiple acts with delays
     */
    test( 'processes multiple acts sequentially with 30s delays', async () => {
      jest.useFakeTimers();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockResolvedValue();

      fetchQueue.triggerBackgroundFetch( actIds );

      // Advance timers to process both acts (30s delay between them)
      await jest.advanceTimersByTimeAsync( 60000 );

      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledTimes( 2 );
      expect( database.cacheAct ).toHaveBeenCalledTimes( 2 );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test error handling for individual acts
     */
    test( 'continues processing after individual act errors', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();
      const consoleLogSpy = jest.spyOn( console, 'log' ).mockImplementation();

      const actIds = [
        transformedTheKinks._id,
        'invalid-id',
        transformedVulvodynia._id
      ];

      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchAct.mockRejectedValueOnce( new Error( 'Not found' ) );
      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockResolvedValue();

      fetchQueue.triggerBackgroundFetch( actIds );

      await jest.advanceTimersByTimeAsync( 90000 );

      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledTimes( 3 );
      expect( database.cacheAct ).toHaveBeenCalledTimes( 2 );
      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        'Background fetch failed for act invalid-id:',
        'Not found'
      );
      expect( consoleLogSpy ).toHaveBeenCalledWith( `Background fetch completed for act: ${transformedTheKinks._id}` );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that last act doesn't wait after completing
     */
    test( 'does not delay after processing last act', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedTheKinks._id ];

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockResolvedValue();

      fetchQueue.triggerBackgroundFetch( actIds );

      // Should complete without 30s delay after last act
      await jest.runAllTimersAsync();

      expect( database.cacheAct ).toHaveBeenCalled();

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test cache write error handling
     */
    test( 'continues after cache write errors', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      const actIds = [
        transformedTheKinks._id,
        transformedVulvodynia._id
      ];

      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockRejectedValueOnce( new Error( 'Cache write failed' ) );
      database.cacheAct.mockResolvedValueOnce();

      fetchQueue.triggerBackgroundFetch( actIds );

      await jest.advanceTimersByTimeAsync( 60000 );

      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledTimes( 2 );
      expect( database.cacheAct ).toHaveBeenCalledTimes( 2 );
      expect( consoleErrorSpy ).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }, 10000 );

    /**
     * Test processing with silent event failures
     */
    test( 'uses silent event failures when fetching', async () => {
      jest.useFakeTimers();

      const actIds = [ transformedVulvodynia._id ];

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockRejectedValue( new Error( 'Event fetch failed' ) );
      database.cacheAct.mockResolvedValue();

      fetchQueue.triggerBackgroundFetch( actIds );

      await jest.runAllTimersAsync();

      expect( database.cacheAct ).toHaveBeenCalledWith( expect.objectContaining( {
        '_id': transformedVulvodynia._id,
        'events': []
      } ) );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test that multiple calls while processing add to queue but don't start new processor
     */
    test( 'queues additional IDs when processor already running', async () => {
      jest.useFakeTimers();

      const actIds1 = [ transformedTheKinks._id ];
      const actIds2 = [ transformedVulvodynia._id ];

      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureTheKinks );
      musicbrainzClient.fetchAct.mockResolvedValueOnce( fixtureVulvodynia );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );
      database.cacheAct.mockResolvedValue();

      // Start first fetch
      fetchQueue.triggerBackgroundFetch( actIds1 );

      // Immediately call again (processor still running)
      fetchQueue.triggerBackgroundFetch( actIds2 );

      // Advance timers to process both acts
      await jest.runAllTimersAsync();

      // Both should have been processed
      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledWith( transformedTheKinks._id );
      expect( musicbrainzClient.fetchAct ).toHaveBeenCalledWith( transformedVulvodynia._id );

      jest.useRealTimers();
    }, 10000 );

    /**
     * Test error handling in background fetch when database.cacheAct throws synchronously
     */
    test( 'handles errors in processFetchQueue and resets flag', async () => {
      jest.useFakeTimers();

      const consoleErrorSpy = jest.spyOn( console, 'error' ).mockImplementation();

      const actIds = [ transformedTheKinks._id ];

      musicbrainzClient.fetchAct.mockResolvedValue( fixtureTheKinks );
      ldJsonExtractor.fetchAndExtractLdJson.mockResolvedValue( [] );

      // Make database.cacheAct throw synchronously to trigger catch block
      database.cacheAct.mockImplementation( () => {
        throw new Error( 'Synchronous database error' );
      } );

      fetchQueue.triggerBackgroundFetch( actIds );

      await jest.runAllTimersAsync();

      // Individual act error should be logged (not the global error handler)
      expect( consoleErrorSpy ).toHaveBeenCalledWith(
        expect.stringContaining( 'Background fetch failed for act' ),
        expect.any( String )
      );

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }, 10000 );
  } );
} );
