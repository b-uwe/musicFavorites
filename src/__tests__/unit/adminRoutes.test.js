/**
 * Unit tests for admin routes
 * Tests health endpoint with mocked dependencies
 * @module __tests__/unit/adminRoutes
 */

const request = require( 'supertest' );
const express = require( 'express' );

// Mock database before routes are loaded
jest.mock( '../../services/database', () => ( {} ), {
  'virtual': true
} );

// Mock middlewares before routes are loaded
jest.mock( '../../middleware/adminAuth', () => ( {} ), {
  'virtual': true
} );
jest.mock( '../../middleware/requestStats', () => ( {} ), {
  'virtual': true
} );

describe( 'Admin Routes - Unit Tests', () => {
  let app;
  let mockAdminAuth;
  let mockGetStats;
  let mockGetAllActIds;
  let mockGetAllActsWithMetadata;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock the authentication middleware
    mockAdminAuth = jest.fn( ( req, res, next ) => next() );

    // Mock request stats
    mockGetStats = jest.fn().mockReturnValue( {
      'totalRequests': 42
    } );

    // Mock database functions
    mockGetAllActIds = jest.fn();
    mockGetAllActsWithMetadata = jest.fn();

    globalThis.mf = globalThis.mf || {};
    mf.database = {
      'getAllActIds': mockGetAllActIds,
      'getAllActsWithMetadata': mockGetAllActsWithMetadata
    };
    mf.adminAuth = mockAdminAuth;
    mf.requestStats = {
      'getStats': mockGetStats
    };

    // Create test app
    app = express();

    // Load routes
    require( '../../routes/admin' );
    app.use( '/admin', mf.adminRoutes );
  } );

  describe( 'GET /admin/health', () => {
    /**
     * Test that health endpoint requires authentication
     */
    test( 'uses admin authentication middleware', async () => {
      mockGetAllActIds.mockResolvedValue( [] );
      mockGetAllActsWithMetadata.mockResolvedValue( [] );

      await request( app ).get( '/admin/health' );

      expect( mockAdminAuth ).toHaveBeenCalled();
    } );

    /**
     * Test successful health check with empty cache
     */
    test( 'returns health data with empty cache', async () => {
      mockGetAllActIds.mockResolvedValue( [] );
      mockGetAllActsWithMetadata.mockResolvedValue( [] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( response.body ).
        toMatchObject( {
          'status': 'ok',
          'cacheSize': 0,
          'lastCacheUpdate': null
        } );
      expect( response.body.uptime ).
        toBeGreaterThan( 0 );
      expect( response.body.memoryUsage ).
        toHaveProperty( 'heapUsed' );
      expect( response.body.memoryUsage ).
        toHaveProperty( 'heapTotal' );
      expect( response.body.memoryUsage ).
        toHaveProperty( 'rss' );
      expect( response.body.requestStats ).
        toEqual( {
          'totalRequests': 42
        } );
    } );

    /**
     * Test health check with cached acts
     */
    test( 'returns correct cache size', async () => {
      mockGetAllActIds.mockResolvedValue( [ 'act1', 'act2', 'act3' ] );
      mockGetAllActsWithMetadata.mockResolvedValue( [
        {
          '_id': 'act1'
        },
        {
          '_id': 'act2'
        },
        {
          '_id': 'act3'
        }
      ] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( response.body.cacheSize ).
        toBe( 3 );
    } );

    /**
     * Test last cache update time with updated acts in ascending order
     */
    test( 'returns most recent cache update time with ascending dates', async () => {
      mockGetAllActIds.mockResolvedValue( [ 'act1', 'act2' ] );
      mockGetAllActsWithMetadata.
        mockResolvedValue( [
          {
            '_id': 'act1',
            'updatedAt': '2025-01-01 10:00:00'
          },
          {
            '_id': 'act2',
            'updatedAt': '2025-01-01 12:00:00'
          }
        ] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( response.body.lastCacheUpdate ).
        toBe( '2025-01-01 12:00:00' );
    } );

    /**
     * Test last cache update time with updated acts in descending order
     */
    test( 'returns most recent cache update time with descending dates', async () => {
      mockGetAllActIds.mockResolvedValue( [ 'act1', 'act2' ] );
      mockGetAllActsWithMetadata.
        mockResolvedValue( [
          {
            '_id': 'act1',
            'updatedAt': '2025-01-01 12:00:00'
          },
          {
            '_id': 'act2',
            'updatedAt': '2025-01-01 10:00:00'
          }
        ] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( response.body.lastCacheUpdate ).
        toBe( '2025-01-01 12:00:00' );
    } );

    /**
     * Test last cache update with no timestamps
     */
    test( 'returns null for lastCacheUpdate when no acts have timestamps', async () => {
      mockGetAllActIds.mockResolvedValue( [ 'act1' ] );
      mockGetAllActsWithMetadata.
        mockResolvedValue( [
          {
            '_id': 'act1'
          }
        ] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( response.body.lastCacheUpdate ).
        toBe( null );
    } );

    /**
     * Test memory usage structure
     */
    test( 'returns memory usage in bytes', async () => {
      mockGetAllActIds.mockResolvedValue( [] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( typeof response.body.memoryUsage.heapUsed ).
        toBe( 'number' );
      expect( typeof response.body.memoryUsage.heapTotal ).
        toBe( 'number' );
      expect( typeof response.body.memoryUsage.rss ).
        toBe( 'number' );
      expect( response.body.memoryUsage.heapUsed ).
        toBeGreaterThan( 0 );
      expect( response.body.memoryUsage.heapTotal ).
        toBeGreaterThan( 0 );
      expect( response.body.memoryUsage.rss ).
        toBeGreaterThan( 0 );
    } );

    /**
     * Test uptime is in seconds
     */
    test( 'returns uptime in seconds', async () => {
      mockGetAllActIds.mockResolvedValue( [] );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 200 );

      expect( typeof response.body.uptime ).
        toBe( 'number' );
      expect( response.body.uptime ).
        toBeGreaterThan( 0 );
    } );

    /**
     * Test error handling when database fails
     */
    test( 'returns 500 when database query fails', async () => {
      mockGetAllActIds.mockRejectedValue( new Error( 'Database error' ) );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 500 );

      expect( response.body ).
        toEqual( {
          'error': 'Failed to fetch health data'
        } );
    } );

    /**
     * Test error handling when metadata query fails
     */
    test( 'returns 500 when metadata query fails', async () => {
      mockGetAllActIds.mockResolvedValue( [ 'act1' ] );
      mockGetAllActsWithMetadata.
        mockRejectedValue( new Error( 'Metadata error' ) );

      const response = await request( app ).
        get( '/admin/health' ).
        expect( 500 );

      expect( response.body ).
        toEqual( {
          'error': 'Failed to fetch health data'
        } );
    } );
  } );

  describe( 'Authentication integration', () => {
    /**
     * Test that failed authentication blocks access
     */
    test( 'returns 401 when authentication fails', async () => {
      // Mock failed authentication
      mf.adminAuth = jest.fn( ( req, res ) => res.status( 401 ).
        json( {
          'error': 'Unauthorized'
        } ) );

      // Reload routes with new auth mock
      jest.resetModules();
      require( '../../routes/admin' );
      app = express();
      app.use( '/admin', mf.adminRoutes );

      await request( app ).
        get( '/admin/health' ).
        expect( 401 );

      expect( mockGetAllActIds ).
        not.
        toHaveBeenCalled();
    } );
  } );
} );
