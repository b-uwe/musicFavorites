/**
 * Unit tests for database module without logger
 * Tests branch coverage for logger absence
 * @module __tests__/unit/services/databaseNoLogger
 */

describe( 'database - No Logger Branch Coverage', () => {
  let noLoggerMockClient;
  let noLoggerMockDb;
  let noLoggerMockCollection;
  let NoLoggerMongoClient;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    process.env.MONGODB_URI = 'mongodb://test:27017';

    // Initialize mf WITHOUT logger
    globalThis.mf = {};

    // Create mock collection
    noLoggerMockCollection = {
      'findOne': jest.fn(),
      'updateOne': jest.fn(),
      'deleteOne': jest.fn()
    };

    // Create mock database
    noLoggerMockDb = {
      'collection': jest.fn().mockReturnValue( noLoggerMockCollection ),
      'command': jest.fn()
    };

    // Create mock client
    noLoggerMockClient = {
      'connect': jest.fn().mockResolvedValue(),
      'close': jest.fn().mockResolvedValue(),
      'db': jest.fn().mockReturnValue( noLoggerMockDb )
    };

    // Mock MongoClient constructor
    const mongodb = require( 'mongodb' );

    NoLoggerMongoClient = jest.fn().mockImplementation( () => noLoggerMockClient );
    mongodb.MongoClient = NoLoggerMongoClient;

    // Require database module AFTER mocking
    require( '../../../services/database' );
  } );

  afterEach( () => {
    delete process.env.MONGODB_URI;
  } );

  /**
   * Test connect and disconnect without logger
   */
  test( 'connect() and disconnect() work without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );

    await mf.database.connect();
    expect( NoLoggerMongoClient ).toHaveBeenCalled();
    expect( noLoggerMockClient.connect ).toHaveBeenCalled();

    await mf.database.disconnect();
    expect( noLoggerMockClient.close ).toHaveBeenCalled();
  } );

  /**
   * Test cache miss without logger
   */
  test( 'getActFromCache() cache miss works without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );
    await mf.database.connect();

    noLoggerMockCollection.findOne.mockResolvedValue( null );

    const result = await mf.database.getActFromCache( 'test-id' );

    expect( result ).toBeNull();
    expect( noLoggerMockCollection.findOne ).toHaveBeenCalledWith( { '_id': 'test-id' } );
  } );

  /**
   * Test cache hit without logger
   */
  test( 'getActFromCache() cache hit works without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );
    await mf.database.connect();

    noLoggerMockCollection.findOne.mockResolvedValue( {
      '_id': 'test-id',
      'name': 'Test Artist'
    } );

    const result = await mf.database.getActFromCache( 'test-id' );

    expect( result ).toEqual( {
      'musicbrainzId': 'test-id',
      'name': 'Test Artist'
    } );
  } );

  /**
   * Test cache write without logger
   */
  test( 'cacheAct() works without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );
    await mf.database.connect();

    noLoggerMockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );

    const artistData = {
      '_id': 'test-id',
      'name': 'Test Artist'
    };

    await mf.database.cacheAct( artistData );

    expect( noLoggerMockCollection.updateOne ).toHaveBeenCalledWith(
      { '_id': 'test-id' },
      { '$set': artistData },
      { 'upsert': true }
    );
  } );

  /**
   * Test health check success without logger
   */
  test( 'testCacheHealth() success works without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );
    await mf.database.connect();

    noLoggerMockCollection.updateOne.mockResolvedValue( { 'acknowledged': true } );
    noLoggerMockCollection.deleteOne.mockResolvedValue( { 'acknowledged': true } );

    await expect( mf.database.testCacheHealth() ).resolves.not.toThrow();

    expect( noLoggerMockCollection.updateOne ).toHaveBeenCalled();
    expect( noLoggerMockCollection.deleteOne ).toHaveBeenCalled();
  } );

  /**
   * Test health check failure without logger
   */
  test( 'testCacheHealth() failure works without logger', async () => {
    noLoggerMockDb.command.mockResolvedValue( { 'ok': 1 } );
    await mf.database.connect();

    noLoggerMockCollection.updateOne.mockResolvedValue( { 'acknowledged': false } );

    await expect( mf.database.testCacheHealth() ).
      rejects.
      toThrow( 'Service temporarily unavailable. Please try again later. (Error: DB_009)' );
  } );
} );
