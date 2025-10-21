/**
 * Unit tests for artistService input validation
 * Testing pure validation logic without external dependencies
 * @module __tests__/unit/services/artistService.input-validation
 */

const artistService = require( '../../../services/artistService' );

describe( 'artistService - Input Validation', () => {
  describe( 'fetchMultipleActs', () => {
    /**
     * Test that empty array returns error
     */
    test( 'returns error for empty array', async () => {
      const result = await artistService.fetchMultipleActs( [] );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
      expect( result.error.message ).toContain( 'non-empty array' );
    } );

    /**
     * Test that non-array input returns error
     */
    test( 'returns error for non-array input', async () => {
      const result = await artistService.fetchMultipleActs( 'not-an-array' );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
      expect( result.error.message ).toContain( 'non-empty array' );
    } );

    /**
     * Test that null returns error
     */
    test( 'returns error for null input', async () => {
      const result = await artistService.fetchMultipleActs( null );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
    } );

    /**
     * Test that undefined returns error
     */
    test( 'returns error for undefined input', async () => {
      const result = await artistService.fetchMultipleActs( undefined );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
    } );

    /**
     * Test that number returns error
     */
    test( 'returns error for number input', async () => {
      const result = await artistService.fetchMultipleActs( 123 );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
    } );

    /**
     * Test that object (non-array) returns error
     */
    test( 'returns error for object input', async () => {
      const result = await artistService.fetchMultipleActs( { 'id': '123' } );

      expect( result.error ).toBeDefined();
      expect( result.error.message ).toContain( 'Invalid input' );
    } );
  } );
} );
