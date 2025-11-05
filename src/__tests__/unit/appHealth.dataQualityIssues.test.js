/**
 * Unit tests for Express app /admin/health route - Data Quality Issues
 * @module __tests__/unit/appHealth.dataQualityIssues
 */

const request = require( 'supertest' );
const speakeasy = require( 'speakeasy' );

require( '../../app' );
require( '../../logger' );

describe( 'Express App - /admin/health Route Tests - Data Quality Issues', () => {
  describe( 'GET /admin/health - Data Quality Issues', () => {
    const validPassword = 'test-admin-password-123';
    const validTotpConfig = {
      'secret': 'JBSWY3DPEHPK3PXP',
      'encoding': 'base32'
    };

    beforeEach( () => {
      process.env.ADMIN_PASS = validPassword;
      process.env.ADMIN_TOTP_CONFIG = JSON.stringify( validTotpConfig );

      // Mock database methods with default empty returns
      mf.database.getAllActIds = jest.fn().mockResolvedValue( [] );
      mf.database.getAllActsWithMetadata = jest.fn().mockResolvedValue( [] );
      mf.database.getActsWithoutBandsintown = jest.fn().mockResolvedValue( [] );
      mf.databaseAdmin.getRecentUpdateErrors = jest.fn().mockResolvedValue( [] );
    } );

    afterEach( () => {
      // Restore original env vars
      delete process.env.ADMIN_PASS;
      delete process.env.ADMIN_TOTP_CONFIG;
    } );

    /**
     * Test categorization of invalid Bandsintown URLs
     */
    test( 'categorizes invalid_bandsintown_url logs correctly', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      // Simulate invalid URL log
      mf.logger.error( {
        'actId': 'test-act-1',
        'invalidUrl': 'https://malicious.com/fake',
        'issue': 'invalid_bandsintown_url'
      }, 'Invalid Bandsintown URL format' );

      const token = speakeasy.totp( validTotpConfig );
      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` ).
        expect( 200 );

      expect( response.body.dataQualityIssues ).toBeDefined();
      expect( response.body.dataQualityIssues.invalidBandsintownUrls ).toHaveLength( 1 );
      expect( response.body.dataQualityIssues.invalidBandsintownUrls[ 0 ] ).toEqual( {
        'timestamp': expect.any( String ),
        'actId': 'test-act-1',
        'invalidUrl': 'https://malicious.com/fake'
      } );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    /**
     * Test categorization of broken event data logs
     */
    test( 'categorizes broken_event_data logs correctly', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      // Simulate broken event data log
      mf.logger.warn( {
        'actId': 'test-act-2',
        'rejectedCount': 2,
        'rejectedEvents': [
          {
            'reason': 'wrong_type',
            'type': 'Event'
          },
          {
            'reason': 'missing_name',
            'date': '2025-12-01'
          }
        ],
        'issue': 'broken_event_data'
      }, 'Bandsintown events rejected' );

      const token = speakeasy.totp( validTotpConfig );
      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` ).
        expect( 200 );

      expect( response.body.dataQualityIssues ).toBeDefined();
      expect( response.body.dataQualityIssues.brokenEventData ).toHaveLength( 1 );
      expect( response.body.dataQualityIssues.brokenEventData[ 0 ] ).toEqual( {
        'timestamp': expect.any( String ),
        'actId': 'test-act-2',
        'rejectedCount': 2,
        'rejectedEvents': [
          {
            'reason': 'wrong_type',
            'type': 'Event'
          },
          {
            'reason': 'missing_name',
            'date': '2025-12-01'
          }
        ]
      } );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );

    /**
     * Test categorization of other logs (not specific issue types)
     */
    test( 'categorizes other logs without specific issue type', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );

      mf.logger.clearLogs();

      // Simulate generic warning without issue field
      mf.logger.warn( {
        'someField': 'someValue',
        'anotherField': 123
      }, 'Generic warning message' );

      const token = speakeasy.totp( validTotpConfig );
      const response = await request( mf.app ).
        get( '/admin/health' ).
        set( 'Authorization', `pass ${validPassword}, bearer ${token}` ).
        expect( 200 );

      expect( response.body.dataQualityIssues ).toBeDefined();
      expect( response.body.dataQualityIssues.other ).toHaveLength( 1 );
      expect( response.body.dataQualityIssues.other[ 0 ] ).toEqual( {
        'timestamp': expect.any( String ),
        'level': 'warn',
        'correlationId': undefined,
        'msg': 'Generic warning message',
        'someField': 'someValue',
        'anotherField': 123
      } );

      process.env.NODE_ENV = originalEnv;
      delete globalThis.mf.logger;
      jest.resetModules();
      require( '../../logger' );
    } );
  } );
} );
