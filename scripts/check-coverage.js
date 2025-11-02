#!/usr/bin/env node
/**
 * Coverage enforcement script
 * Ensures 100% coverage on ALL metrics before allowing server start
 * This script is called by npm start via prestart hook
 */

const { execSync } = require( 'child_process' );

console.log( '🔍 Check 1: Unit test coverage (MANDATORY 100% on Stmts, Funcs, Lines)...' );

try {
  // Check 1: Unit tests must have 100% Stmts, Funcs, Lines
  const unitOutput = execSync(
    'npx jest --coverage --silent src/__tests__/testHelpers src/__tests__/unit',
    { 'encoding': 'utf-8' }
  );

  const unitOutputLines = unitOutput.split( '\n' );
  const unitAllFilesLine = unitOutputLines.find( ( line ) => line.includes( 'All files' ) );

  if ( !unitAllFilesLine ) {
    console.error( '❌ ERROR: Could not parse unit coverage output!' );
    process.exit( 1 );
  }

  const unitParts = unitAllFilesLine.split( '|' ).map( ( part ) => part.trim() );
  const unitStmts = parseFloat( unitParts[ 1 ] );
  const unitFuncs = parseFloat( unitParts[ 3 ] );
  const unitLinesCov = parseFloat( unitParts[ 4 ] );

  console.log( `Unit Coverage: Stmts=${unitStmts}% Funcs=${unitFuncs}% Lines=${unitLinesCov}%` );

  if ( unitStmts !== 100 || unitFuncs !== 100 || unitLinesCov !== 100 ) {
    console.error( '❌ START REJECTED: Unit tests must have 100% Stmts, Funcs, Lines!' );
    console.error( 'See CLAUDE.md point #1' );
    process.exit( 1 );
  }

  console.log( '✅ Check 1 passed: Unit tests have 100% Stmts, Funcs, Lines' );

  // Check 2: ALL tests must have 100% on ALL metrics including Branch
  console.log( '🔍 Check 2: All tests with 100% coverage on ALL metrics including Branch...' );

  const fullOutput = execSync(
    'npx jest --coverage --silent',
    { 'encoding': 'utf-8' }
  );

  const fullOutputLines = fullOutput.split( '\n' );
  const fullAllFilesLine = fullOutputLines.find( ( line ) => line.includes( 'All files' ) );

  if ( !fullAllFilesLine ) {
    console.error( '❌ ERROR: Could not parse full coverage output!' );
    process.exit( 1 );
  }

  // Check that tests actually passed
  if ( fullOutput.includes( 'Tests:' ) && fullOutput.match( /Tests:.*failed/ui ) ) {
    console.error( '❌ START REJECTED: Some tests failed!' );
    process.exit( 1 );
  }

  const fullParts = fullAllFilesLine.split( '|' ).map( ( part ) => part.trim() );
  const fullStmts = parseFloat( fullParts[ 1 ] );
  const fullBranch = parseFloat( fullParts[ 2 ] );
  const fullFuncs = parseFloat( fullParts[ 3 ] );
  const fullLinesCov = parseFloat( fullParts[ 4 ] );

  console.log( `Full Coverage: Stmts=${fullStmts}% Branch=${fullBranch}% Funcs=${fullFuncs}% Lines=${fullLinesCov}%` );

  if ( fullStmts !== 100 || fullBranch !== 100 || fullFuncs !== 100 || fullLinesCov !== 100 ) {
    console.error( '❌ START REJECTED: Full coverage must be 100% on ALL metrics!' );
    console.error( 'See CLAUDE.md point #4 - 100% branch coverage is MANDATORY.' );
    process.exit( 1 );
  }

  console.log( '✅ Check 2 passed: All tests pass with 100% coverage on ALL metrics' );
  console.log( '✅ COVERAGE CHECKS PASSED! Starting server...' );
  process.exit( 0 );
} catch ( error ) {
  console.error( '❌ START REJECTED: Coverage check failed!' );
  console.error( error.message );
  process.exit( 1 );
}
