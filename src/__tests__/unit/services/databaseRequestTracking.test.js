/**
 * Unit tests for database request tracking functions
 * @module __tests__/unit/services/databaseRequestTracking
 */

const { MongoClient } = require( 'mongodb' );


describe( 'database - Request Tracking Tests', () => {
  let mockCollection;
  let mockDb;
  let mockClient;

  beforeEach( () => {
    jest.clearAllMocks();

    // Setup MongoDB mocks
    mockCollection = {
      'updateOne': jest.fn(),
      'find': jest.fn(),
      'deleteMany': jest.fn()
    };

    mockDb = {
      'collection': jest.fn( () => mockCollection ),
      'command': jest.fn().mockResolvedValue( { 'ok': 1 } )
    };

    mockClient = {
      'db': jest.fn( () => mockDb ),
      'connect': jest.fn().mockResolvedValue(),
      'close': jest.fn().mockResolvedValue()
    };

    MongoClient.mockImplementation( () => mockClient );

    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

    // Reset the database module
    delete require.cache[ require.resolve( '../../../services/database' ) ];
    delete require.cache[ require.resolve( '../../../services/actService' ) ];

    // Mock actService
    globalThis.mf = globalThis.mf || {};
    globalThis.mf.actService = {
      'getBerlinTimestamp': jest.fn( () => '2024-01-15 10:30:00+01:00' )
    };

    // Require database to initialize mf.database
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  describe( 'updateLastRequestedAt', () => {
    /**
     * Test that it throws DB_023 error when client is null
     */
    test( 'throws DB_023 error when client is null', async () => {
      await expect( mf.database.updateLastRequestedAt( [ 'test-id' ] ) ).
        rejects.
        toThrow( /DB_023/u );
    } );

    /**
     * Test that it throws DB_024 error when actIds is not an array
     */
    test( 'throws DB_024 error when actIds is not an array', async () => {
      await mf.database.connect();

      await expect( mf.database.updateLastRequestedAt( 'not-an-array' ) ).
        rejects.
        toThrow( /DB_024/u );
    } );

    /**
     * Test that it throws DB_024 error when actIds is empty array
     */
    test( 'throws DB_024 error when actIds is empty array', async () => {
      await mf.database.connect();

      await expect( mf.database.updateLastRequestedAt( [] ) ).
        rejects.
        toThrow( /DB_024/u );
    } );

    /**
     * Test that it updates metadata for single act
     */
    test( 'updates metadata for single act', async () => {
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

      await mf.database.connect();
      await mf.database.updateLastRequestedAt( [ 'test-id-1' ] );

      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        { '_id': 'test-id-1' },
        {
          '$set': {
            'lastRequestedAt': expect.any( String ),
            'updatesSinceLastRequest': 0
          }
        },
        { 'upsert': true }
      );
    } );

    /**
     * Test that it updates metadata for multiple acts
     */
    test( 'updates metadata for multiple acts', async () => {
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

      await mf.database.connect();
      await mf.database.updateLastRequestedAt( [ 'test-id-1', 'test-id-2', 'test-id-3' ] );

      expect( mockCollection.updateOne ).toHaveBeenCalledTimes( 3 );
    } );

    /**
     * Test that it throws DB_025 error when update not acknowledged
     */
    test( 'throws DB_025 error when update not acknowledged', async () => {
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

      await mf.database.connect();

      await expect( mf.database.updateLastRequestedAt( [ 'test-id' ] ) ).
        rejects.
        toThrow( /DB_025/u );
    } );
  } );

  describe( 'removeActsNotRequestedFor14Updates', () => {
    /**
     * Test that it throws DB_026 error when client is null
     */
    test( 'throws DB_026 error when client is null', async () => {
      // Disconnect first to clear the client
      await mf.database.disconnect();

      // Reset database module to clear client
      delete require.cache[ require.resolve( '../../../services/database' ) ];
      delete require.cache[ require.resolve( '../../../services/actService' ) ];

      // Setup new mocks
      const newMockCollection = {
        'updateOne': jest.fn(),
        'find': jest.fn(),
        'deleteMany': jest.fn()
      };

      const newMockDb = {
        'collection': jest.fn( () => newMockCollection ),
        'command': jest.fn().mockResolvedValue( { 'ok': 1 } )
      };

      const newMockClient = {
        'db': jest.fn( () => newMockDb ),
        'connect': jest.fn().mockResolvedValue(),
        'close': jest.fn().mockResolvedValue()
      };

      MongoClient.mockImplementation( () => newMockClient );

      // Mock actService again
      globalThis.mf = globalThis.mf || {};
      globalThis.mf.actService = {
        'getBerlinTimestamp': jest.fn( () => '2024-01-15 10:30:00+01:00' )
      };

      // Require database again to reinitialize with null client
      require( '../../../services/database' );

      await expect( mf.database.removeActsNotRequestedFor14Updates() ).
        rejects.
        toThrow( /DB_026/u );
    } );

    /**
     * Test that it returns 0 when no stale acts found
     */
    test( 'returns 0 when no stale acts found', async () => {
      mockCollection.find.mockReturnValue( {
        'toArray': jest.fn().mockResolvedValue( [] )
      } );

      await mf.database.connect();
      const result = await mf.database.removeActsNotRequestedFor14Updates();

      expect( result ).toEqual( { 'deletedCount': 0 } );
    } );

    /**
     * Test that it removes stale acts and metadata
     */
    test( 'removes stale acts and metadata', async () => {
      const staleMetadata = [
        { '_id': 'act-1',
          'updatesSinceLastRequest': 14 },
        { '_id': 'act-2',
          'updatesSinceLastRequest': 20 }
      ];

      mockCollection.find.mockReturnValue( {
        'toArray': jest.fn().mockResolvedValue( staleMetadata )
      } );

      mockCollection.deleteMany.mockResolvedValue( {
        'acknowledged': true,
        'deletedCount': 2
      } );

      await mf.database.connect();
      const result = await mf.database.removeActsNotRequestedFor14Updates();

      expect( result ).toEqual( { 'deletedCount': 2 } );
      expect( mockCollection.deleteMany ).toHaveBeenCalledWith( {
        '_id': { '$in': [ 'act-1', 'act-2' ] }
      } );
    } );

    /**
     * Test that it throws DB_027 error when delete not acknowledged
     */
    test( 'throws DB_027 error when delete not acknowledged', async () => {
      const staleMetadata = [
        { '_id': 'act-1',
          'updatesSinceLastRequest': 14 }
      ];

      mockCollection.find.mockReturnValue( {
        'toArray': jest.fn().mockResolvedValue( staleMetadata )
      } );

      mockCollection.deleteMany.mockResolvedValue( {
        'acknowledged': false,
        'deletedCount': 0
      } );

      await mf.database.connect();

      await expect( mf.database.removeActsNotRequestedFor14Updates() ).
        rejects.
        toThrow( /DB_027/u );
    } );
  } );
} );
