/**
 * Unit tests for database module
 * Tests business logic by mocking MongoDB client
 * @module __tests__/unit/services/database
 */

// Mock mongodb before requiring database
jest.mock( 'mongodb' );

describe( 'database - Unit Tests', () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let MongoClient;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create mock collection
    mockCollection = {
      'findOne': jest.fn(),
      'updateOne': jest.fn(),
      'deleteOne': jest.fn(),
      'find': jest.fn()
    };

    // Create mock database
    mockDb = {
      'collection': jest.fn().mockReturnValue( mockCollection ),
      'command': jest.fn()
    };

    // Create mock client
    mockClient = {
      'connect': jest.fn().mockResolvedValue(),
      'close': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( mockDb )
    };

    // Mock MongoClient constructor
    const mongodb = require( 'mongodb' );

    MongoClient = jest.fn().mockImplementation( () => mockClient );
    mongodb.MongoClient = MongoClient;

    // Require database module AFTER mocking (sets up mf.database)
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  describe( 'connect', () => {
    /**
     * Test throws DB_001 when MONGODB_URI is missing
     */
    test( 'throws DB_001 error when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;

      await expect( mf.database.connect() ).
        rejects.
        toThrow( 'Service misconfigured. Please try again later. (Error: DB_001)' );
    } );

    /**
     * Test successful connection sets client
     */
    test( 'creates client and connects on first call', async () => {
      // Mock successful ping
      mockDb.command.mockResolvedValue( { 'ok': 1 } );

      await mf.database.connect();

      expect( MongoClient ).toHaveBeenCalled();
      expect( mockClient.connect ).toHaveBeenCalled();
      expect( mockDb.command ).toHaveBeenCalledWith( { 'ping': 1 } );
    } );

    /**
     * Test throws DB_002 when ping fails
     */
    test( 'throws DB_002 error when ping response is not ok', async () => {
      // Mock failed ping
      mockDb.command.mockResolvedValue( { 'ok': 0 } );

      await expect( mf.database.connect() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_002)' );
    } );

    /**
     * Test throws DB_011 on connection error
     */
    test( 'throws DB_011 error and resets client on connection failure', async () => {
      mockClient.connect.mockRejectedValue( new Error( 'Connection refused' ) );

      await expect( mf.database.connect() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_011)' );
    } );

    /**
     * Test reuses existing client
     */
    test( 'reuses existing client on subsequent calls', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );

      // First call - creates client
      await mf.database.connect();
      const firstCallCount = MongoClient.mock.calls.length;

      // Second call - reuses client (won't create new one)
      await mf.database.connect();
      expect( MongoClient.mock.calls.length ).toBe( firstCallCount );
      // But ping called twice
      expect( mockDb.command ).toHaveBeenCalledTimes( 2 );
    } );
  } );

  describe( 'disconnect', () => {
    /**
     * Test closes client and resets
     */
    test( 'closes client and resets to null', async () => {
      // First connect to establish client
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await mf.database.disconnect();

      expect( mockClient.close ).toHaveBeenCalled();
    } );

    /**
     * Test returns early when no client
     */
    test( 'returns early when client is null', async () => {
      // Don't connect first - client should be null
      await mf.database.disconnect();

      expect( mockClient.close ).not.toHaveBeenCalled();
    } );

    /**
     * Test throws DB_012 on close error
     */
    test( 'throws DB_012 error on close failure', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockClient.close.mockRejectedValue( new Error( 'Close failed' ) );

      await expect( mf.database.disconnect() ).
        rejects.
        toThrow( 'Service temporarily unavailable during disconnection. (Error: DB_012)' );
    } );
  } );

  describe( 'getDatabase', () => {
    /**
     * Test throws DB_003 when not connected
     */
    test( 'throws DB_003 error when client is null', () => {
      expect( () => mf.testing.database.getDatabase( 'testdb' ) ).
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_003)' );
    } );

    /**
     * Test returns database instance
     */
    test( 'returns database instance when connected', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const db = mf.testing.database.getDatabase( 'testdb' );

      expect( mockClient.db ).toHaveBeenCalledWith( 'testdb' );
      expect( db ).toBe( mockDb );
    } );
  } );

  describe( 'getArtistFromCache', () => {
    /**
     * Test throws DB_004 when not connected
     */
    test( 'throws DB_004 error when client is null', async () => {
      await expect( mf.database.getArtistFromCache( 'test-id' ) ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_004)' );
    } );

    /**
     * Test returns null when artist not found
     */
    test( 'returns null when artist is not in cache', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.findOne.mockResolvedValue( null );

      const result = await mf.database.getArtistFromCache( 'test-id' );

      expect( result ).toBeNull();
      expect( mockCollection.findOne ).toHaveBeenCalledWith( { '_id': 'test-id' } );
    } );

    /**
     * Test returns artist with musicbrainzId mapping
     */
    test( 'returns artist data with _id mapped to musicbrainzId', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.findOne.mockResolvedValue( {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      } );

      const result = await mf.database.getArtistFromCache( 'test-id' );

      expect( result ).toEqual( {
        'musicbrainzId': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      } );
    } );
  } );

  describe( 'cacheArtist', () => {
    /**
     * Test throws DB_005 when not connected
     */
    test( 'throws DB_005 error when client is null', async () => {
      await expect( mf.database.cacheArtist( { '_id': 'test-id' } ) ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_005)' );
    } );

    /**
     * Test throws DB_006 when artistData missing _id
     */
    test( 'throws DB_006 error when artistData has no _id', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      await expect( mf.database.cacheArtist( { 'name': 'Test' } ) ).
        rejects.
        toThrow( 'Invalid request. Please try again later. (Error: DB_006)' );
    } );

    /**
     * Test upserts artist data
     */
    test( 'upserts artist data to cache', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

      const artistData = {
        '_id': 'test-id',
        'name': 'Test Artist',
        'status': 'active'
      };

      await mf.database.cacheArtist( artistData );

      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        { '_id': 'test-id' },
        { '$set': artistData },
        { 'upsert': true }
      );
    } );

    /**
     * Test throws DB_007 when write not acknowledged
     */
    test( 'throws DB_007 error when write is not acknowledged', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

      await expect( mf.database.cacheArtist( { '_id': 'test-id' } ) ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_007)' );
    } );
  } );

  describe( 'testCacheHealth', () => {
    /**
     * Test throws DB_008 when not connected
     */
    test( 'throws DB_008 error when client is null', async () => {
      await expect( mf.database.testCacheHealth() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_008)' );
    } );

    /**
     * Test successful health check
     */
    test( 'performs write and delete operations for health check', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );
      mockCollection.deleteOne.mockResolvedValue( { 'acknowledged': true } );

      await mf.database.testCacheHealth();

      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        { '_id': '__health_check__' },
        {
          '$set': {
            '_id': '__health_check__',
            'name': 'Health Check',
            'testEntry': true
          }
        },
        { 'upsert': true }
      );
      expect( mockCollection.deleteOne ).toHaveBeenCalledWith( { '_id': '__health_check__' } );
    } );

    /**
     * Test throws DB_009 when write not acknowledged
     */
    test( 'throws DB_009 error and resets client when write fails', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

      await expect( mf.database.testCacheHealth() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_009)' );
    } );

    /**
     * Test throws DB_010 when delete not acknowledged
     */
    test( 'throws DB_010 error and resets client when delete fails', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );
      mockCollection.deleteOne.mockResolvedValue( { 'acknowledged': false } );

      await expect( mf.database.testCacheHealth() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_010)' );
    } );

    /**
     * Test resets client on any error
     */
    test( 'resets client on health check error', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      mockCollection.updateOne.mockRejectedValue( new Error( 'DB error' ) );

      await expect( mf.database.testCacheHealth() ).rejects.toThrow();
    } );
  } );

  describe( 'getAllActIds', () => {
    /**
     * Test throws DB_013 when not connected
     */
    test( 'throws DB_013 error when client is null', async () => {
      await expect( mf.database.getAllActIds() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_013)' );
    } );

    /**
     * Test returns sorted array of IDs
     */
    test( 'returns sorted array of all cached act IDs', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          { '_id': 'id3' },
          { '_id': 'id1' },
          { '_id': 'id2' }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActIds();

      expect( mockCollection.find ).toHaveBeenCalledWith( {}, { 'projection': { '_id': 1 } } );
      expect( result ).toEqual( [ 'id1', 'id2', 'id3' ] );
    } );
  } );

  describe( 'getAllActsWithMetadata', () => {
    /**
     * Test throws DB_014 when not connected
     */
    test( 'throws DB_014 error when client is null', async () => {
      await expect( mf.database.getAllActsWithMetadata() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_014)' );
    } );

    /**
     * Test returns sorted array with metadata
     */
    test( 'returns sorted array of acts with _id and updatedAt', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': 'id3',
            'updatedAt': '2025-01-03'
          },
          {
            '_id': 'id1',
            'updatedAt': '2025-01-01'
          },
          {
            '_id': 'id2',
            'updatedAt': '2025-01-02'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActsWithMetadata();

      expect( mockCollection.find ).toHaveBeenCalledWith( {}, { 'projection': { '_id': 1,
        'updatedAt': 1 } } );
      expect( result ).toEqual( [
        {
          '_id': 'id1',
          'updatedAt': '2025-01-01'
        },
        {
          '_id': 'id2',
          'updatedAt': '2025-01-02'
        },
        {
          '_id': 'id3',
          'updatedAt': '2025-01-03'
        }
      ] );
    } );

    /**
     * Test handles equal IDs in sort comparator (returns 0)
     */
    test( 'handles duplicate IDs in sort comparator', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': 'same-id',
            'updatedAt': '2025-01-01'
          },
          {
            '_id': 'same-id',
            'updatedAt': '2025-01-02'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActsWithMetadata();

      // Should handle equal IDs without error
      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ]._id ).toBe( 'same-id' );
      expect( result[ 1 ]._id ).toBe( 'same-id' );
    } );
  } );
} );
