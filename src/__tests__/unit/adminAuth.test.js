/**
 * Unit tests for admin authentication middleware
 * Tests TOTP verification logic with mocked speakeasy
 * @module __tests__/unit/adminAuth
 */

jest.mock( 'speakeasy', () => ( {
  'totp': {
    'verify': jest.fn()
  }
} ) );

const speakeasy = require( 'speakeasy' );

// Load middleware after mock is set up
require( '../../middleware/adminAuth' );

describe( 'Admin Authentication Middleware - Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach( () => {
    jest.clearAllMocks();

    // Mock environment variable
    process.env.ADMIN_TOTP_SECRET = 'test-secret-key';

    // Setup mock request, response, next
    mockReq = {
      'headers': {}
    };
    mockRes = {
      'status': jest.fn().mockReturnThis(),
      'json': jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  } );

  afterEach( () => {
    delete process.env.ADMIN_TOTP_SECRET;
  } );

  describe( 'Missing TOTP secret configuration', () => {
    /**
     * Test that middleware fails when ADMIN_TOTP_SECRET is not configured
     */
    test( 'returns 500 when ADMIN_TOTP_SECRET is not set', () => {
      delete process.env.ADMIN_TOTP_SECRET;

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( mockRes.status ).toHaveBeenCalledWith( 500 );
      expect( mockRes.json ).toHaveBeenCalledWith( {
        'error': 'Admin authentication not configured'
      } );
      expect( mockNext ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'Missing Authorization header', () => {
    /**
     * Test that middleware fails when Authorization header is missing
     */
    test( 'returns 401 when Authorization header is missing', () => {
      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( mockRes.status ).toHaveBeenCalledWith( 401 );
      expect( mockRes.json ).toHaveBeenCalledWith( {
        'error': 'Unauthorized'
      } );
      expect( mockNext ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'Invalid Authorization header format', () => {
    /**
     * Test that middleware fails when Authorization header has wrong format
     */
    test( 'returns 401 when Authorization header is not Bearer format', () => {
      mockReq.headers.authorization = 'Basic sometoken';

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( mockRes.status ).toHaveBeenCalledWith( 401 );
      expect( mockRes.json ).toHaveBeenCalledWith( {
        'error': 'Unauthorized'
      } );
      expect( mockNext ).not.toHaveBeenCalled();
    } );

    /**
     * Test that middleware fails when token is missing after Bearer
     */
    test( 'returns 401 when Bearer token is empty', () => {
      mockReq.headers.authorization = 'Bearer ';

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( mockRes.status ).toHaveBeenCalledWith( 401 );
      expect( mockRes.json ).toHaveBeenCalledWith( {
        'error': 'Unauthorized'
      } );
      expect( mockNext ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'Invalid TOTP token', () => {
    /**
     * Test that middleware fails when TOTP verification fails
     */
    test( 'returns 401 when TOTP token is invalid', () => {
      mockReq.headers.authorization = 'Bearer 123456';
      speakeasy.totp.verify.mockReturnValue( false );

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( speakeasy.totp.verify ).toHaveBeenCalledWith( {
        'secret': 'test-secret-key',
        'encoding': 'base32',
        'token': '123456',
        'window': 1
      } );
      expect( mockRes.status ).toHaveBeenCalledWith( 401 );
      expect( mockRes.json ).toHaveBeenCalledWith( {
        'error': 'Unauthorized'
      } );
      expect( mockNext ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'Valid TOTP token', () => {
    /**
     * Test that middleware succeeds when TOTP verification passes
     */
    test( 'calls next() when TOTP token is valid', () => {
      mockReq.headers.authorization = 'Bearer 123456';
      speakeasy.totp.verify.mockReturnValue( true );

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( speakeasy.totp.verify ).toHaveBeenCalledWith( {
        'secret': 'test-secret-key',
        'encoding': 'base32',
        'token': '123456',
        'window': 1
      } );
      expect( mockNext ).toHaveBeenCalled();
      expect( mockRes.status ).not.toHaveBeenCalled();
      expect( mockRes.json ).not.toHaveBeenCalled();
    } );

    /**
     * Test that middleware handles token with extra whitespace
     */
    test( 'handles token with extra whitespace', () => {
      mockReq.headers.authorization = 'Bearer  123456  ';
      speakeasy.totp.verify.mockReturnValue( true );

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( speakeasy.totp.verify ).toHaveBeenCalledWith( {
        'secret': 'test-secret-key',
        'encoding': 'base32',
        'token': '123456',
        'window': 1
      } );
      expect( mockNext ).toHaveBeenCalled();
    } );
  } );

  describe( 'Case-insensitive Bearer keyword', () => {
    /**
     * Test that middleware accepts lowercase bearer
     */
    test( 'accepts lowercase "bearer" keyword', () => {
      mockReq.headers.authorization = 'bearer 123456';
      speakeasy.totp.verify.mockReturnValue( true );

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( speakeasy.totp.verify ).toHaveBeenCalledWith( {
        'secret': 'test-secret-key',
        'encoding': 'base32',
        'token': '123456',
        'window': 1
      } );
      expect( mockNext ).toHaveBeenCalled();
    } );

    /**
     * Test that middleware accepts mixed case bearer
     */
    test( 'accepts mixed case "BeArEr" keyword', () => {
      mockReq.headers.authorization = 'BeArEr 123456';
      speakeasy.totp.verify.mockReturnValue( true );

      mf.adminAuth( mockReq, mockRes, mockNext );

      expect( mockNext ).toHaveBeenCalled();
    } );
  } );
} );
