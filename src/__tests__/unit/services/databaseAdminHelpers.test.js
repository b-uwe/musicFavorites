/**
 * Unit tests for databaseAdmin module helper functions
 * Tests logSlowOperation and updateActMetadata helpers
 * @module __tests__/unit/services/databaseAdminHelpers
 */

describe( 'databaseAdmin - Helper Functions', () => {
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
      'updateOne': jest.fn(),
      'insertOne': jest.fn(),
      'deleteMany': jest.fn(),
      'find': jest.fn()
    };

    // Create mock database
    mockDb = {
      'command': jest.fn(),
      'collection': jest.fn().mockReturnValue( mockCollection )
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

    // Require database module AFTER mocking
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  describe( 'updateActMetadata helper', () => {
    /**
     * Test updateActMetadata successfully updates metadata
     */
    test( 'updates act metadata with correct parameters', async () => {
      // Mock successful update
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      // Call helper directly
      await mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'test-id',
        timestamp
      );

      // Verify updateOne was called with correct parameters
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        { '_id': 'test-id' },
        {
          '$set': {
            'lastRequestedAt': timestamp,
            'updatesSinceLastRequest': 0
          }
        },
        { 'upsert': true }
      );
    } );

    /**
     * Test updateActMetadata throws DB_025 when update not acknowledged
     */
    test( 'throws DB_025 when update is not acknowledged', async () => {
      // Mock failed update
      mockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      // Call helper directly
      await expect( mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'test-id',
        timestamp
      ) ).rejects.toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_025)' );
    } );

    /**
     * Test updateActMetadata with upsert creates new document
     */
    test( 'upserts metadata document when it does not exist', async () => {
      mockCollection.updateOne.mockResolvedValue( {
        'acknowledged': true,
        'upsertedCount': 1
      } );

      const timestamp = '2025-01-15 10:30:00+01:00';

      await mf.testing.databaseAdmin.updateActMetadata(
        mockCollection,
        'new-id',
        timestamp
      );

      // Verify upsert option was passed
      expect( mockCollection.updateOne ).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { 'upsert': true }
      );
    } );
  } );
} );
