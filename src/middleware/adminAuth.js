/**
 * Admin authentication middleware using TOTP
 * @module middleware/adminAuth
 */

( () => {
  'use strict';

  const speakeasy = require( 'speakeasy' );

  /**
   * Validates Bearer token format and extracts token
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token or null if invalid
   */
  const extractBearerToken = ( authHeader ) => {
    const bearerPattern = /^bearer\s+(?<token>.+)$/ui;
    const match = authHeader.match( bearerPattern );

    if ( !match || !match.groups ) {
      return null;
    }

    const token = match.groups.token.trim();

    return token || null;
  };

  /**
   * Middleware to authenticate admin requests using TOTP
   * Validates Bearer token in Authorization header against TOTP secret
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {Function} next - Express next middleware function
   * @returns {object|void} Returns 401 response if unauthorized, calls next() if authorized
   */
  const adminAuth = ( req, res, next ) => {
    const totpSecret = process.env.ADMIN_TOTP_SECRET;

    if ( !totpSecret ) {
      return res.status( 500 ).json( {
        'error': 'Admin authentication not configured'
      } );
    }

    const authHeader = req.headers.authorization;

    if ( !authHeader ) {
      return res.status( 401 ).json( {
        'error': 'Unauthorized'
      } );
    }

    const token = extractBearerToken( authHeader );

    if ( !token ) {
      return res.status( 401 ).json( {
        'error': 'Unauthorized'
      } );
    }

    const verified = speakeasy.totp.verify( {
      'secret': totpSecret,
      'encoding': 'base32',
      token,
      'window': 1
    } );

    if ( !verified ) {
      return res.status( 401 ).json( {
        'error': 'Unauthorized'
      } );
    }

    return next();
  };

  // Initialize global namespace
  globalThis.mf = globalThis.mf || {};
  globalThis.mf.adminAuth = adminAuth;
} )();
