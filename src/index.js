/**
 * Server entry point
 * Starts the Express server on the configured port
 */

const app = require( './app' );

const PORT = process.env.PORT || 3000;

app.listen( PORT, () => {
  console.log( `Music Favorites API running on port ${PORT}` );
} );
