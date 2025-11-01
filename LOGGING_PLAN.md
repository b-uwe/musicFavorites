# Logging Implementation Plan - Music Favorites API

## Overview

This document outlines the comprehensive plan to add structured logging to the Music Favorites API using Pino. The implementation is divided into 8 separate PRs to ensure maintainability, reviewability, and incremental delivery.

## Goals

1. **Replace all console.* statements** with structured logging
2. **Add comprehensive logging** for debugging and production monitoring
3. **Maintain clean test output** (silent mode in tests)
4. **Preserve 100% test coverage** across all metrics
5. **Zero breaking changes** to existing functionality
6. **Environment-based log levels** (test=silent, dev=debug, prod=info)

## Configuration Decisions

### Technology Choice: Pino

- **Selected**: Pino (raw JSON output)
- **Rejected**: pino-pretty (unnecessary dependency, JSON is fine for Render)
- **Rationale**:
  - High performance (async, low overhead)
  - Structured JSON logging
  - Simple configuration
  - No formatting overhead in production

### Log Levels

| Environment | Level | Purpose |
|------------|-------|---------|
| `test` | `silent` | Clean test output, no console pollution |
| `development` | `debug` | Maximum verbosity for local debugging |
| `production` | `info` | Balanced logging for Render deployment |

**Note**: Production level will be gradually reduced over time (info → warn → error) based on operational needs.

### Test Strategy

- **Unit tests**: Logger completely silent (no output)
- **Integration tests**: Logger completely silent (no output)
- **Exception**: HTTP/DB calls will log at ERROR level in tests to detect missing mocks (future PRs)

## PR Breakdown

### Generics

1. For each PR, follow the process defined in CLAUDE.md
2. Make sure THIS file is never committed or pushed!

---

## ✅ PR #1: Logger Infrastructure Setup (COMPLETED)

**Status**: Merged
**Branch**: `feature/add-pino-logger`
**PR**: https://github.com/b-uwe/musicFavorites/pull/81

### What Was Done

1. Installed `pino` dependency
2. Added logger to `src/app.js` with environment-based configuration
3. Exported via `globalThis.mf.logger`

### Files Changed

- `package.json` + `package-lock.json` - Added pino dependency
- `src/app.js` - Logger initialization (+19 lines)
- `src/__tests__/unit/app.test.js` - Unit tests (+53 lines)
- `src/__tests__/coverage/app.test.js` - Coverage tests (cleaned up, -31 lines)

---

## ✅ PR #2: Server Lifecycle Logging

**Status**: Next
**Branch**: `feature/logging-server-lifecycle`

### Changes

Update `src/index.js` to replace all console.* statements:

| Line | Current | Replace With | Level |
|------|---------|--------------|-------|
| 24 | `console.log('Server running...')` | `logger.info()` | info |
| 38 | `console.log('Connected to MongoDB')` | `logger.info()` | info |
| 42 | `console.error('Cache updater crashed')` | `logger.error()` | error |
| 45 | `console.error('MongoDB connection failed')` | `logger.error()` | error |
| 46 | `console.error('Database unavailable')` | `logger.warn()` | warn |

### Log Message Format

```javascript
// Before
console.log(`Music Favorites API running on port ${PORT}`);

// After
logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started');
```

### Testing Strategy

- Update server lifecycle integration tests
- Verify logger calls in unit tests
- Ensure graceful shutdown logging works correctly
- Maintain 100% coverage according to CLAUDE.md, chapter "Quality"

### Files to Modify

- `src/index.js` (~5 lines changed)
- `src/__tests__/integration/serverLifecycle.integration.test.js` (update assertions)
- Possibly add unit tests if coverage requires

---

## ✅ PR #3: HTTP Request/Response Logging

**Status**: Planned
**Branch**: `feature/logging-http-requests`

### Changes

Add request/response logging middleware to `src/app.js`:

```javascript
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip
    }, 'HTTP request');
  });

  next();
});
```

### Special Consideration for Tests

**In test environment**: HTTP middleware should log at ERROR level to catch missing mocks:

```javascript
const logLevel = process.env.NODE_ENV === 'test' ? 'error' : 'info';
logger[logLevel]({ /* ... */ }, 'HTTP request');
```

### Testing Strategy

- Add unit tests for middleware behavior
- Add integration tests for request logging
- Verify ERROR level in tests catches missing mocks
- Test pretty parameter logging
- Maintain 100% coverage

### Files to Modify

- `src/app.js` (~15 lines added for middleware)
- `src/__tests__/unit/app.test.js` (add middleware tests)
- `src/__tests__/integration/app.integration.test.js` (verify logging)

---

## ✅ PR #4: External API Logging (MusicBrainz & Bandsintown)

**Status**: Completed
**Branch**: `feature/logging-external-apis`
**PR**: (to be added after creation)

### Changes

#### `src/services/musicbrainz.js`

Add logging before/after API calls:

```javascript
// Before request
logger.debug({ artistId, url }, 'Fetching from MusicBrainz');

// After successful response
logger.info({ artistId, status, duration, dataSize }, 'MusicBrainz fetch successful');

// On error
logger.error({ artistId, error: error.message, status }, 'MusicBrainz API error');
```

#### `src/services/ldJsonExtractor.js`

Log HTML fetching and parsing:

```javascript
logger.debug({ url }, 'Fetching Bandsintown HTML');
logger.info({ url, eventCount, duration }, 'Parsed Bandsintown events');
logger.warn({ url, error }, 'Failed to extract LD+JSON');
```

### Special Consideration for Tests

External API calls should log at ERROR level in tests to catch missing mocks.

### Testing Strategy

- Update unit tests for musicbrainz.js
- Update unit tests for ldJsonExtractor.js
- Verify integration tests still pass
- Test error scenarios produce proper logs
- Maintain 100% coverage

### Files to Modify

- `src/services/musicbrainz.js` (~10 lines added)
- `src/services/ldJsonExtractor.js` (~8 lines added)
- `src/__tests__/unit/services/musicbrainz.test.js` (update)
- `src/__tests__/unit/utilities/ldJsonExtractor.test.js` (update)

---

## 🔄 PR #5: Database Operation Logging

**Status**: Planned
**Branch**: `feature/logging-database-ops`

### Changes

Update `src/services/database.js` to log all 27 database functions:

#### Connection Operations
```javascript
// connect()
logger.info({ uri: MONGODB_URI.replace(/\/\/.*@/, '//***@') }, 'Connecting to MongoDB');
logger.info('MongoDB connected successfully');

// disconnect()
logger.info('Disconnecting from MongoDB');

// testCacheHealth()
logger.debug('Testing cache health');
logger.warn('Cache health check failed');
```

#### Cache Operations
```javascript
// getActFromCache()
logger.debug({ actId }, 'Cache lookup');
logger.debug({ actId, hit: true }, 'Cache hit');
logger.debug({ actId, hit: false }, 'Cache miss');

// cacheAct()
logger.debug({ actId }, 'Caching act data');
```

#### Slow Query Warnings
```javascript
if (duration > 100) {
  logger.warn({ operation, duration, actId }, 'Slow database operation');
}
```

### Special Consideration for Tests

Database calls should log at ERROR level in tests to catch missing mocks.

### Testing Strategy

- Update all database unit tests
- Verify slow query warnings work
- Test error scenarios
- Maintain 100% coverage

### Files to Modify

- `src/services/database.js` (~50 lines added across 27 functions)
- `src/__tests__/unit/services/database.test.js` (update)
- `src/__tests__/unit/services/databaseErrors.test.js` (update)
- `src/__tests__/unit/services/databaseRequestTracking.test.js` (update)
- `src/__tests__/unit/services/databaseClearCache.test.js` (update)

---

## 🔄 PR #6: Background Job Logging (Cache Updater)

**Status**: Planned
**Branch**: `feature/logging-cache-updater`

### Changes

Update `src/services/cacheUpdater.js` to replace 4 console.error statements and add structured logging:

| Line | Current | Replace With |
|------|---------|--------------|
| 70 | `console.error('Failed to update act')` | `logger.error()` |
| 82 | `console.error('Failed to log error')` | `logger.error()` |
| 113 | `console.error('Cycle error')` | `logger.error()` |
| 173 | `console.error('Sequential update error')` | `logger.error()` |

#### Additional Logging

```javascript
// Cycle start
logger.info({ phase: 'sequential' }, 'Starting cache update cycle');

// Cycle completion
logger.info({
  phase: 'perpetual',
  actsProcessed,
  successCount,
  errorCount,
  duration
}, 'Cache update cycle completed');

// Performance metrics
logger.info({ actsPerHour }, 'Cache update performance');
```

### Testing Strategy

- Update cacheUpdater unit tests
- Update cacheUpdater integration tests
- Verify error logging works correctly
- Maintain 100% coverage

### Files to Modify

- `src/services/cacheUpdater.js` (~20 lines changed)
- `src/__tests__/unit/services/cacheUpdater.test.js` (update)
- `src/__tests__/integration/cacheUpdater.integration.test.js` (update)

---

## 🔄 PR #7: Background Job Logging (Fetch Queue)

**Status**: Planned
**Branch**: `feature/logging-fetch-queue`

### Changes

Update `src/services/fetchQueue.js` to replace console.error and add logging:

| Line | Current | Replace With |
|------|---------|--------------|
| 92 | `console.error('Background fetch error')` | `logger.error()` |

#### Additional Logging

```javascript
// Queue processing start
logger.info({ queueDepth: actIds.length }, 'Starting background fetch queue');

// Per-act fetch
logger.debug({ actId, position, total }, 'Fetching act in background');

// Queue completion
logger.info({
  actsProcessed,
  successCount,
  errorCount,
  duration
}, 'Background fetch queue completed');

// Delay logging
logger.debug({ delayMs: 30000 }, 'Waiting before next fetch');
```

### Testing Strategy

- Update fetchQueue unit tests
- Update fetchQueue integration tests
- Verify queue state logging
- Maintain 100% coverage

### Files to Modify

- `src/services/fetchQueue.js` (~15 lines changed)
- `src/__tests__/unit/services/fetchQueue.test.js` (update)
- `src/__tests__/integration/fetchQueue.integration.test.js` (update)

---

## 🔄 PR #8: Service Layer Logging (Act Service)

**Status**: Planned
**Branch**: `feature/logging-act-service`

### Changes

Update `src/services/actService.js` to add business logic logging:

#### Cache Strategy Decisions
```javascript
// Cache hit
logger.debug({ actId, strategy: 'cache-hit' }, 'Serving from cache');

// Cache miss
logger.info({ actId, strategy: 'cache-miss' }, 'Cache miss, fetching from upstream');

// Stale data
logger.info({ actId, strategy: 'stale-serve', age }, 'Serving stale data, queuing refresh');
```

#### Data Enrichment
```javascript
// Enrichment start
logger.debug({ actId }, 'Starting data enrichment');

// Enrichment steps
logger.debug({ actId, step: 'musicbrainz' }, 'Fetching MusicBrainz data');
logger.debug({ actId, step: 'events' }, 'Fetching Bandsintown events');

// Enrichment complete
logger.info({
  actId,
  hasBandsintown,
  eventCount,
  status,
  duration
}, 'Data enrichment completed');
```

#### Request Correlation
```javascript
// Add correlation ID for tracing requests through async flows
const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
logger.info({ correlationId, actIds }, 'Processing multiple acts request');
```

### Testing Strategy

- Update actService unit tests
- Update actService integration tests
- Verify correlation IDs work
- Test all cache strategies log correctly
- Maintain 100% coverage

### Files to Modify

- `src/services/actService.js` (~30 lines added)
- `src/__tests__/unit/services/actService.test.js` (update)
- `src/__tests__/unit/services/actService.staleness.test.js` (update)
- `src/__tests__/unit/services/actService.urlValidation.test.js` (update)
- `src/__tests__/integration/actService.integration.test.js` (update)

---

## Quality Requirements (All PRs)

Every PR must meet these requirements before merge:

### 1. Linting
```bash
npm run lint
```
- ✅ Zero errors
- ✅ Zero new warnings (pre-existing TODO warning is acceptable)

### 2. Unit Test Coverage
```bash
npx jest --coverage src/__tests__/testHelpers src/__tests__/unit
```
- ✅ **Stmts**: 100%
- ✅ **Funcs**: 100%
- ✅ **Lines**: 100%
- ✅ Branch coverage as high as possible through unit tests

### 3. Full Test Suite
```bash
npm test
```
- ✅ All tests pass (no failures)
- ✅ Test output is clean (silent logger in tests)

### 4. Combined Coverage (Unit + Coverage Tests)
```bash
npx jest --coverage src/__tests__/testHelpers src/__tests__/unit src/__tests__/coverage
```
- ✅ **Stmts**: 100%
- ✅ **Funcs**: 100%
- ✅ **Lines**: 100%
- ✅ **Branch**: 100%

### 5. Boy Scout Rule
- Clean up any code you touch
- Fix any obvious issues in surrounding code
- Improve readability where possible

### 6. Manual Testing
Before pushing, start the server and verify:
```bash
npm start
```
- ✅ Server starts without errors
- ✅ `/health` endpoint responds
- ✅ Logging works as expected (check output in development mode)

### 7. Git Workflow
- ✅ Checkout main and pull latest
- ✅ Create feature branch
- ✅ Make changes
- ✅ Run linting + tests
- ✅ Commit with descriptive message
- ✅ **MANDATORY STOP**: Start server, test functionality, get confirmation
- ✅ Push to remote
- ✅ Create PR with detailed description
- ✅ Check for merge conflicts
- ✅ Assign to Uwe Bernitt

---

## Log Message Best Practices

### Structure

```javascript
logger.level(
  { /* context object */ },
  'Human-readable message'
);
```

### Context Object Guidelines

1. **Include relevant identifiers**: actId, requestId, correlationId
2. **Include metrics**: duration, count, size
3. **Include state**: status, phase, step
4. **Don't include sensitive data**: passwords, tokens, full connection strings
5. **Keep it flat**: Avoid deep nesting

### Message Guidelines

1. **Be concise**: Short, clear descriptions
2. **Use present tense**: "Fetching data" not "Fetched data"
3. **Be consistent**: Use same terminology across codebase
4. **Avoid noise**: Don't log trivial operations

### Examples

✅ Good:
```javascript
logger.info({ actId, duration: 145, status: 200 }, 'MusicBrainz fetch completed');
logger.error({ actId, error: 'timeout', retryCount: 3 }, 'MusicBrainz fetch failed');
logger.warn({ queueDepth: 500 }, 'Background queue growing large');
```

❌ Bad:
```javascript
logger.info('Got data!'); // No context
logger.info({ actId, data: hugeObject }, 'Fetched'); // Too much data
logger.info({ a: { b: { c: { d: 'value' } } } }, 'Done'); // Too nested
```

---

## Testing Log Output

### In Development (Visual Inspection)

```bash
NODE_ENV=development npm start
```

Logs will appear as JSON:
```json
{"level":30,"time":1698765432000,"msg":"Server started","port":3000}
```

### In Tests (Verification)

Tests should verify logger is called with correct parameters:

```javascript
test('logs server startup', () => {
  // Spy on logger
  const infoSpy = jest.spyOn(mf.logger, 'info');

  // Trigger action
  startServer();

  // Verify log call
  expect(infoSpy).toHaveBeenCalledWith(
    { port: 3000, env: 'test' },
    'Server started'
  );

  infoSpy.mockRestore();
});
```

---

## Performance Considerations

1. **Pino is async by default**: Minimal blocking
2. **Target**: <5ms overhead per log operation
3. **Monitor**: Watch for slow logs in production
4. **Avoid**: Logging in tight loops (consider sampling)

---

## Production Rollout Strategy

### Phase 1: INFO level (Initial)
- Deploy all PRs with `info` level in production
- Monitor for any issues
- Collect feedback on log volume

### Phase 2: Reduce to WARN (After 2-4 weeks)
- Change production level to `warn`
- Only warnings and errors logged
- Reduced noise, clearer signals

### Phase 3: Reduce to ERROR (Long-term goal)
- Change production level to `error`
- Only actual errors logged
- Minimal log volume, maximum signal

### Level Changes

Update `src/app.js`:
```javascript
const getLogLevel = () => {
  if (process.env.NODE_ENV === 'test') {
    return 'silent';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'error'; // Changed from 'info'
  }
  return 'debug';
};
```

---

## Render Deployment Notes

### Viewing Logs

1. **Dashboard**: https://dashboard.render.com → Service → Logs tab
2. **CLI**: `render logs --service musicFavorites --tail`

### Log Retention

- **Free tier**: 7 days
- **Paid tier**: Longer retention (varies by plan)

### Log Format

Render captures stdout/stderr automatically:
- Development: Human-readable (if using pino-pretty locally)
- Production: JSON (native Pino output)
- Render's log viewer can search/filter JSON fields

---

## Troubleshooting

### Issue: Tests are noisy
**Solution**: Ensure `NODE_ENV=test` is set in test scripts

### Issue: Coverage dropped
**Solution**: Add tests for new log code paths, especially error scenarios

### Issue: Logs not appearing in Render
**Solution**: Verify logger writes to stdout, check Render dashboard

### Issue: Performance impact
**Solution**: Reduce log level, check for logs in tight loops

---

## Future Enhancements (Not in Scope)

1. **Log aggregation service** (Datadog, Splunk, ELK)
2. **Custom log formatters** for different outputs
3. **Request ID middleware** for better tracing
4. **Performance metrics** logging (separate from business logs)
5. **Alert integration** (PagerDuty, Slack)

---

## References

- **Pino Documentation**: https://getpino.io/
- **12-Factor App Logging**: https://12factor.net/logs
- **Render Logging**: https://render.com/docs/logs

---

## Completion Checklist

- [x] PR #1: Logger Infrastructure Setup
- [x] PR #2: Server Lifecycle Logging
- [x] PR #3: HTTP Request/Response Logging
- [x] PR #4: External API Logging
- [ ] PR #5: Database Operation Logging
- [ ] PR #6: Background Job Logging (Cache Updater)
- [ ] PR #7: Background Job Logging (Fetch Queue)
- [ ] PR #8: Service Layer Logging (Act Service)

---

**Last Updated**: 2025-11-01
**Status**: PRs #1-4 Complete, PR #5 Next
**Owner**: Claude Code + Uwe Bernitt
