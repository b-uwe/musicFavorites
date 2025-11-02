/**
 * Unit tests for database query functions
 * Tests business logic by mocking MongoDB client
 * @module __tests__/unit/services/databaseQuery
 */

// Mock mongodb before requiring database

describe( 'database - Query Functions Unit Tests', () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let MongoClient;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set MONGODB_URI for tests
    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Create minimal logger mock BEFORE loading database module
    globalThis.mf = globalThis.mf || {};
    globalThis.mf.logger = {
      'debug': jest.fn(),
      'info': jest.fn(),
      'warn': jest.fn(),
      'error': jest.fn()
    };

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

    /**
     * Test returns empty array when cache is empty
     */
    test( 'returns empty array when no acts in cache', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActIds();

      expect( result ).toEqual( [] );
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

    /**
     * Test handles acts with missing updatedAt field
     */
    test( 'handles acts with missing updatedAt field', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': 'id2'
          },
          {
            '_id': 'id1',
            'updatedAt': '2025-01-02 12:00:00'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActsWithMetadata();

      expect( result ).toHaveLength( 2 );
      expect( result[ 0 ]._id ).toBe( 'id1' );
      expect( result[ 0 ].updatedAt ).toBe( '2025-01-02 12:00:00' );
      expect( result[ 1 ]._id ).toBe( 'id2' );
      expect( result[ 1 ].updatedAt ).toBeUndefined();
    } );

    /**
     * Test returns empty array when cache is empty
     */
    test( 'returns empty array when no acts in cache', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getAllActsWithMetadata();

      expect( result ).toEqual( [] );
    } );
  } );

  describe( 'getActsWithoutBandsintown', () => {
    /**
     * Test throws DB_015 error when not connected
     */
    test( 'throws DB_015 error when not connected', async () => {
      await expect( mf.database.getActsWithoutBandsintown() ).
        rejects.
        toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_015)' );
    } );

    /**
     * Test returns acts without bandsintown relation
     */
    test( 'returns only MBIDs for acts without bandsintown relation', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          {
            '_id': 'mbid-1'
          },
          {
            '_id': 'mbid-2'
          }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getActsWithoutBandsintown();

      expect( mockCollection.find ).toHaveBeenCalledWith(
        {
          '$or': [
            { 'relations.bandsintown': { '$exists': false } },
            { 'relations.bandsintown': null }
          ]
        },
        {
          'projection': {
            '_id': 1
          }
        }
      );
      expect( result ).toEqual( [ 'mbid-1', 'mbid-2' ] );
    } );

    /**
     * Test returns sorted array of MBIDs
     */
    test( 'returns sorted array of MBIDs', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [
          { '_id': 'zebra-mbid' },
          { '_id': 'alpha-mbid' },
          { '_id': 'beta-mbid' }
        ] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getActsWithoutBandsintown();

      expect( result ).toEqual( [ 'alpha-mbid', 'beta-mbid', 'zebra-mbid' ] );
    } );

    /**
     * Test returns empty array when all acts have bandsintown
     */
    test( 'returns empty array when all acts have bandsintown', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getActsWithoutBandsintown();

      expect( result ).toEqual( [] );
    } );

    /**
     * Test returns empty array when cache is empty
     */
    test( 'returns empty array when cache is empty', async () => {
      mockDb.command.mockResolvedValue( { 'ok': 1 } );
      await mf.database.connect();

      const mockCursor = {
        'toArray': jest.fn().mockResolvedValue( [] )
      };

      mockCollection.find.mockReturnValue( mockCursor );

      const result = await mf.database.getActsWithoutBandsintown();

      expect( result ).toEqual( [] );
    } );
  } );
} );
