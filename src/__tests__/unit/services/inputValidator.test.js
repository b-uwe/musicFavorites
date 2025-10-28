/**
 * Unit tests for inputValidator module
 * Tests validation functions for backend service inputs
 * @module __tests__/unit/services/inputValidator
 */

describe( 'inputValidator', () => {
  beforeEach( () => {
    jest.clearAllMocks();
    jest.resetModules();

    require( '../../../services/inputValidator' );
  } );

  describe( 'validateMbid', () => {
    /**
     * Test valid MBID formats
     */
    test( 'returns true for valid MBID', () => {
      const validMbids = [
        '53689c08-f234-4c47-9256-58c8568f06d1',
        'a74b1b7f-71a5-4011-9441-d0b5e4122711',
        '00000000-0000-0000-0000-000000000000',
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'
      ];

      for ( const mbid of validMbids ) {
        expect( mf.inputValidator.validateMbid( mbid ) ).toBe( true );
      }
    } );

    /**
     * Test invalid MBID formats
     */
    test( 'returns false for invalid MBID format', () => {
      const invalidMbids = [
        'not-a-uuid',
        '53689c08-f234-4c47-9256',
        '53689c08-f234-4c47-9256-58c8568f06d1-extra',
        '53689c08f2344c47925658c8568f06d1',
        'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
        '53689c08-f234-4c47-9256-58c8568f06d1 ',
        ' 53689c08-f234-4c47-9256-58c8568f06d1',
        ''
      ];

      for ( const mbid of invalidMbids ) {
        expect( mf.inputValidator.validateMbid( mbid ) ).toBe( false );
      }
    } );

    /**
     * Test non-string inputs
     */
    test( 'returns false for non-string inputs', () => {
      expect( mf.inputValidator.validateMbid( null ) ).toBe( false );
      expect( mf.inputValidator.validateMbid( undefined ) ).toBe( false );
      expect( mf.inputValidator.validateMbid( 123 ) ).toBe( false );
      expect( mf.inputValidator.validateMbid( {} ) ).toBe( false );
      expect( mf.inputValidator.validateMbid( [] ) ).toBe( false );
    } );

    /**
     * Test case sensitivity
     */
    test( 'accepts both uppercase and lowercase hex digits', () => {
      expect( mf.inputValidator.validateMbid( '53689c08-f234-4c47-9256-58c8568f06d1' ) ).toBe( true );
      expect( mf.inputValidator.validateMbid( '53689C08-F234-4C47-9256-58C8568F06D1' ) ).toBe( true );
      expect( mf.inputValidator.validateMbid( '53689C08-f234-4c47-9256-58c8568f06d1' ) ).toBe( true );
    } );
  } );

  describe( 'validateUrl', () => {
    /**
     * Test valid HTTP URLs
     */
    test( 'returns true for valid HTTP URLs', () => {
      const validUrls = [
        'http://example.com',
        'http://example.com/path',
        'http://example.com/path?query=value',
        'http://subdomain.example.com',
        'http://example.com:8080',
        'http://example.com/path#fragment'
      ];

      for ( const url of validUrls ) {
        expect( mf.inputValidator.validateUrl( url ) ).toBe( true );
      }
    } );

    /**
     * Test valid HTTPS URLs
     */
    test( 'returns true for valid HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://www.bandsintown.com/a/6461184',
        'https://www.songkick.com/artists/8816354',
        'https://subdomain.example.com/path?query=value#fragment'
      ];

      for ( const url of validUrls ) {
        expect( mf.inputValidator.validateUrl( url ) ).toBe( true );
      }
    } );

    /**
     * Test invalid URL formats
     */
    test( 'returns false for invalid URL format', () => {
      const invalidUrls = [
        'not-a-url',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'example.com',
        ''
      ];

      for ( const url of invalidUrls ) {
        expect( mf.inputValidator.validateUrl( url ) ).toBe( false );
      }
    } );

    /**
     * Test non-HTTP/HTTPS protocols are rejected
     */
    test( 'returns false for ftp protocol', () => {
      expect( mf.inputValidator.validateUrl( 'ftp://example.com' ) ).toBe( false );
    } );

    /**
     * Test non-string inputs
     */
    test( 'returns false for non-string inputs', () => {
      expect( mf.inputValidator.validateUrl( null ) ).toBe( false );
      expect( mf.inputValidator.validateUrl( undefined ) ).toBe( false );
      expect( mf.inputValidator.validateUrl( 123 ) ).toBe( false );
      expect( mf.inputValidator.validateUrl( {} ) ).toBe( false );
      expect( mf.inputValidator.validateUrl( [] ) ).toBe( false );
    } );

    /**
     * Test URLs with special characters
     */
    test( 'returns true for URLs with properly encoded special characters', () => {
      const validUrls = [
        'https://example.com/path%20with%20spaces',
        'https://example.com/path?param=value%20with%20spaces',
        'https://example.com/path?param1=value1&param2=value2'
      ];

      for ( const url of validUrls ) {
        expect( mf.inputValidator.validateUrl( url ) ).toBe( true );
      }
    } );

    /**
     * Test malformed URLs
     */
    test( 'returns false for malformed URLs', () => {
      const malformedUrls = [
        'http://example .com',
        'https://[invalid-ipv6]'
      ];

      for ( const url of malformedUrls ) {
        expect( mf.inputValidator.validateUrl( url ) ).toBe( false );
      }
    } );
  } );
} );
