#!/usr/bin/env node
/**
 * Coverage enforcement script
 * Ensures 100% coverage on Stmts, Funcs, Lines before allowing server start
 * This script is called by npm start via prestart hook
 */

const { execSync } = require( 'child_process' );

console.log( '🔍 Checking unit test coverage (MANDATORY 100% on Stmts, Funcs, Lines)...' );

try {
  const output = execSync(
    'npx jest --coverage --silent src/__tests__/testHelpers src/__tests__/unit',
    { 'encoding': 'utf-8' }
  );

  // Find the "All files" line in coverage output
  const lines = output.split( '\n' );
  const allFilesLine = lines.find( ( line ) => line.includes( 'All files' ) );

  if ( !allFilesLine ) {
    console.error( '❌ ERROR: Could not parse coverage output!' );
    console.error( 'Coverage output:', output );
    process.exit( 1 );
  }

  // Parse coverage percentages
  const parts = allFilesLine.split( '|' ).map( ( part ) => part.trim() );
  const stmts = parseFloat( parts[ 1 ] );
  const funcs = parseFloat( parts[ 3 ] );
  const lines = parseFloat( parts[ 4 ] );

  console.log( `Coverage: Stmts=${stmts}% Funcs=${funcs}% Lines=${lines}%` );

  // Check for 100% coverage
  if ( stmts !== 100 ) {
    console.error( `❌ START REJECTED: Statement coverage is ${stmts}%, MUST be 100%!` );
    console.error( 'See CLAUDE.md - 100% coverage on Stmts, Funcs, Lines is MANDATORY.' );
    process.exit( 1 );
  }

  if ( funcs !== 100 ) {
    console.error( `❌ START REJECTED: Function coverage is ${funcs}%, MUST be 100%!` );
    console.error( 'See CLAUDE.md - 100% coverage on Stmts, Funcs, Lines is MANDATORY.' );
    process.exit( 1 );
  }

  if ( lines !== 100 ) {
    console.error( `❌ START REJECTED: Line coverage is ${lines}%, MUST be 100%!` );
    console.error( 'See CLAUDE.md - 100% coverage on Stmts, Funcs, Lines is MANDATORY.' );
    process.exit( 1 );
  }

  console.log( '✅ Coverage check passed! Starting server...' );
  process.exit( 0 );
} catch ( error ) {
  console.error( '❌ START REJECTED: Coverage check failed!' );
  console.error( error.message );
  process.exit( 1 );
}
