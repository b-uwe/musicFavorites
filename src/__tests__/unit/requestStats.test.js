/**
 * Unit tests for request statistics middleware
 * Tests request counting and stats retrieval
 * @module __tests__/unit/requestStats
 */

describe( 'Request Statistics Middleware - Unit Tests', () => {
  let requestStatsMiddleware;
  let getRequestStats;
  let resetRequestStats;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Require middleware
    require( '../../middleware/requestStats' );
    requestStatsMiddleware = mf.requestStats.middleware;
    getRequestStats = mf.requestStats.getStats;
    resetRequestStats = mf.requestStats.reset;

    // Reset stats before each test
    resetRequestStats();

    // Setup mock request, response, next
    mockReq = {
      'method': 'GET',
      'path': '/test'
    };
    mockRes = {};
    mockNext = jest.fn();
  } );

  describe( 'Request counting', () => {
    /**
     * Test that middleware increments total requests
     */
    test( 'increments total request count', () => {
      requestStatsMiddleware( mockReq, mockRes, mockNext );

      const stats = getRequestStats();

      expect( stats.totalRequests ).toBe( 1 );
      expect( mockNext ).toHaveBeenCalled();
    } );

    /**
     * Test that multiple requests increment count
     */
    test( 'increments count for multiple requests', () => {
      requestStatsMiddleware( mockReq, mockRes, mockNext );
      requestStatsMiddleware( mockReq, mockRes, mockNext );
      requestStatsMiddleware( mockReq, mockRes, mockNext );

      const stats = getRequestStats();

      expect( stats.totalRequests ).toBe( 3 );
      expect( mockNext ).toHaveBeenCalledTimes( 3 );
    } );
  } );

  describe( 'Stats retrieval', () => {
    /**
     * Test that initial stats are zero
     */
    test( 'returns zero for initial stats', () => {
      const stats = getRequestStats();

      expect( stats.totalRequests ).toBe( 0 );
    } );

    /**
     * Test that stats object is immutable
     */
    test( 'returns new object each time (not mutable reference)', () => {
      const stats1 = getRequestStats();

      requestStatsMiddleware( mockReq, mockRes, mockNext );
      const stats2 = getRequestStats();

      expect( stats1.totalRequests ).toBe( 0 );
      expect( stats2.totalRequests ).toBe( 1 );
    } );
  } );

  describe( 'Stats reset', () => {
    /**
     * Test that reset clears request count
     */
    test( 'resets total requests to zero', () => {
      requestStatsMiddleware( mockReq, mockRes, mockNext );
      requestStatsMiddleware( mockReq, mockRes, mockNext );

      expect( getRequestStats().totalRequests ).toBe( 2 );

      resetRequestStats();

      expect( getRequestStats().totalRequests ).toBe( 0 );
    } );
  } );

  describe( 'Middleware behavior', () => {
    /**
     * Test that middleware always calls next()
     */
    test( 'always calls next() to continue request chain', () => {
      requestStatsMiddleware( mockReq, mockRes, mockNext );

      expect( mockNext ).toHaveBeenCalledWith();
    } );

    /**
     * Test that middleware does not modify request or response
     */
    test( 'does not modify request or response objects', () => {
      const reqCopy = { ...mockReq };
      const resCopy = { ...mockRes };

      requestStatsMiddleware( mockReq, mockRes, mockNext );

      expect( mockReq ).toEqual( reqCopy );
      expect( mockRes ).toEqual( resCopy );
    } );
  } );
} );
