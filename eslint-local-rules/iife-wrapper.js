/**
 * Custom ESLint rule to enforce IIFE wrapper pattern
 * Ensures non-test files are wrapped in an IIFE with 'use strict'
 */

module.exports = {
  'meta': {
    'type': 'problem',
    'docs': {
      'description': 'Enforce IIFE wrapper pattern for non-test files',
      'category': 'Best Practices'
    },
    'messages': {
      'requireIIFE': 'File must be wrapped in an IIFE: ( () => { \'use strict\'; ... } )()',
      'requireStrict': 'IIFE must start with \'use strict\' directive'
    }
  },
  'create': ( context ) => {
    return {
      'Program': ( node ) => {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const statements = node.body;

        // Find the first non-comment statement
        const firstStatement = statements.find( ( stmt ) => stmt.type !== 'Line' && stmt.type !== 'Block' );

        // Check if it's an IIFE
        const isIIFE = firstStatement &&
          firstStatement.type === 'ExpressionStatement' &&
          firstStatement.expression.type === 'CallExpression' &&
          firstStatement.expression.callee.type === 'ArrowFunctionExpression';

        if ( !isIIFE ) {
          context.report( {
            'node': node,
            'messageId': 'requireIIFE'
          } );

          return;
        }

        // Check for 'use strict' directive
        const iifeBody = firstStatement.expression.callee.body;

        if ( iifeBody.type === 'BlockStatement' ) {
          const firstBodyStatement = iifeBody.body[ 0 ];
          const hasUseStrict = firstBodyStatement &&
            firstBodyStatement.type === 'ExpressionStatement' &&
            firstBodyStatement.expression.type === 'Literal' &&
            firstBodyStatement.expression.value === 'use strict';

          if ( !hasUseStrict ) {
            context.report( {
              'node': firstStatement,
              'messageId': 'requireStrict'
            } );
          }
        }
      }
    };
  }
};
