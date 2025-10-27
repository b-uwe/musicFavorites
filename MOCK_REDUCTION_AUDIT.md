# Integration Test Mock Reduction Audit

**Date:** 2025-10-27
**Purpose:** Identify and fix business logic mocking in integration tests
**Goal:** Replace business logic mocks with HTTP/Database mocks to enable true integration testing

---

## Executive Summary

**CRITICAL FINDING:** All 13 integration test files are mocking **BUSINESS LOGIC** modules instead of external I/O (HTTP/Database).

### Current (Wrong) Approach:
```javascript
jest.mock('../../services/database');           // ❌ Mocks business logic
jest.mock('../../services/musicbrainz');         // ❌ Mocks business logic
jest.mock('../../services/ldJsonExtractor');     // ❌ Mocks business logic
```

### Correct Approach:
```javascript
jest.mock('axios');                              // ✅ Mock HTTP layer
jest.mock('mongodb');                            // ✅ Mock database layer
// Use REAL business logic modules
```

---

## What IS and ISN'T Mocking

### ✅ ACCEPTABLE (Not mocking business logic):
- **Mock `axios`** - HTTP client library (external I/O)
- **Mock `mongodb` MongoClient** - Database driver (external I/O)
- **Use fixtures** - Test data from files
- **Use `fixtureModifier`** - Test utility to manipulate fixtures
- **Use `jest.useFakeTimers()`** - Controlling time flow
- **Use `supertest`** - Testing Express apps
- **Modify internal state between tests** - Test setup/teardown

### ❌ UNACCEPTABLE (Mocking business logic):
- **Mock `database.js`** - Business logic that orchestrates MongoDB
- **Mock `musicbrainz.js`** - Business logic that calls MusicBrainz API
- **Mock `ldJsonExtractor.js`** - Business logic that extracts LD+JSON
- **Mock transformers** - Business logic that transforms data
- **Mock `actService.js`** - Core business logic
- **Mock `fetchQueue.js`** - Queue management logic
- **Mock `cacheUpdater.js`** - Cache update logic

---

## File-by-File Analysis

### EASY (Simple workflows, straightforward to fix)

#### 1. ✅ ldJsonExtractor.integration.test.js
**Current Status:** Mocks `ldJsonExtractor` business logic
**Tests:** ldJsonExtractor → bandsintownTransformer flow
**Fix Required:**
- Remove `jest.mock('../../services/ldJsonExtractor')`
- Add `jest.mock('axios')`
- Mock `axios.get()` to return fixture HTML
- Use real `ldJsonExtractor.fetchAndExtractLdJson()`

**Complexity:** LOW - Only tests one simple workflow
**Priority:** HIGH - Good starting point

---

#### 2. ✅ transformers.integration.test.js
**Current Status:** Mocks `ldJsonExtractor` business logic
**Tests:** musicbrainzTransformer → bandsintownTransformer pipeline
**Fix Required:**
- Remove `jest.mock('../../services/ldJsonExtractor')`
- Add `jest.mock('axios')`
- Mock `axios.get()` to return fixture HTML
- Use real transformer logic

**Complexity:** LOW - Transformer-focused, minimal HTTP calls
**Priority:** HIGH - Clean integration test

---

#### 3. ✅ serverLifecycle.integration.test.js
**Current Status:** Mocks `database` business logic
**Tests:** Server startup sequence
**Fix Required:**
- Remove `jest.mock('../../services/database')`
- Add `jest.mock('mongodb')`
- Mock MongoClient connection and ping
- Use real `database.connect()` and `database.testCacheHealth()`

**Complexity:** LOW - Focused on startup, not data flow
**Priority:** HIGH - Tests critical startup path

---

### CHALLENGING (Complex workflows, need careful setup)

#### 4. ⚠️ actService.integration.test.js
**Current Status:** Mocks `database`, `musicbrainz`, `ldJsonExtractor`
**Tests:** Full actService workflows
**Fix Required:**
- Mock `axios` for HTTP calls
- Mock `mongodb` for database
- Setup complex fixtures for multi-step workflows

**Complexity:** MEDIUM - Tests many workflows
**Priority:** MEDIUM - Core service tests

---

#### 5. ⚠️ cacheUpdater.integration.test.js
**Current Status:** Mocks `database`, `musicbrainz`, `ldJsonExtractor`
**Tests:** Cache update workflows
**Fix Required:**
- Mock `axios` and `mongodb`
- Coordinate fake timers with real async operations
- Handle sequential update logic

**Complexity:** MEDIUM - Involves timing logic
**Priority:** MEDIUM

---

#### 6. ⚠️ database.integration.test.js
**Current Status:** Mocks `database`, `musicbrainz`, `ldJsonExtractor`
**Tests:** Database error handling and resilience
**Fix Required:**
- Mock `mongodb` with various failure scenarios
- Mock `axios` for upstream calls
- Test real error propagation through business logic

**Complexity:** MEDIUM - Error scenarios
**Priority:** MEDIUM

---

#### 7. ⚠️ fetchQueue.integration.test.js
**Current Status:** Mocks `database`, `musicbrainz`, `ldJsonExtractor`
**Tests:** Background fetch queue processing
**Fix Required:**
- Mock `axios` and `mongodb`
- Test real queue management with fake timers
- Ensure circular dependency resolution works

**Complexity:** MEDIUM - Queue state management
**Priority:** MEDIUM

---

#### 8. ⚠️ errorPropagation.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Error propagation through layers
**Fix Required:**
- Mock `axios` and `mongodb` to throw errors
- Test real error handling through all layers
- Verify Express error middleware integration

**Complexity:** MEDIUM - Error scenarios
**Priority:** MEDIUM

---

#### 9. ⚠️ resilience.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Connection resilience and recovery
**Fix Required:**
- Mock `mongodb` with connection failures
- Test real retry logic
- Coordinate with fake timers

**Complexity:** MEDIUM - Stateful connection handling
**Priority:** MEDIUM

---

#### 10. ⚠️ scalability.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Large batch operations and queue limits
**Fix Required:**
- Mock `axios` and `mongodb` for high volume
- Test real batch processing logic
- Memory and performance validation

**Complexity:** MEDIUM-HIGH - Performance testing
**Priority:** MEDIUM

---

#### 11. ⚠️ upstreamErrors.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Upstream API error handling
**Fix Required:**
- Mock `axios` with various HTTP error codes
- Test real error handling and recovery
- Validate error messages to users

**Complexity:** MEDIUM - Error scenarios
**Priority:** MEDIUM

---

### REALLY CHALLENGING (Full E2E, may need alternative approach)

#### 12. 🔴 app.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Full Express routes E2E
**Fix Required:**
- Mock `axios` and `mongodb` for all routes
- Test through real Express middleware stack
- Consider `mongodb-memory-server` for true E2E

**Complexity:** HIGH - Full request/response cycle
**Priority:** LOW - Consider after other tests pass
**Alternative:** May benefit from mongodb-memory-server

---

#### 13. 🔴 workflows.integration.test.js
**Current Status:** Mocks all external modules
**Tests:** Real-world user workflow scenarios
**Fix Required:**
- Similar to app.integration.test.js
- Complex multi-request scenarios
- Consider mongodb-memory-server

**Complexity:** HIGH - Multi-step workflows
**Priority:** LOW - Consider after other tests pass
**Alternative:** May benefit from mongodb-memory-server

---

## Implementation Strategy

### Phase 1: EASY Wins (THIS PR)
**Files:** 3 files
1. ldJsonExtractor.integration.test.js
2. transformers.integration.test.js
3. serverLifecycle.integration.test.js

**Approach:**
- Set up axios mocking pattern
- Create reusable mock helpers if needed
- Validate all tests pass
- Document patterns for next phase

**Expected Outcome:**
- 3 tests using real business logic
- Clear pattern for HTTP mocking
- Foundation for Phase 2

---

### Phase 2: CHALLENGING Tests (Future PR)
**Files:** 8 files (actService through upstreamErrors)

**Approach:**
- Apply axios/mongodb mocking patterns
- Handle complex workflows
- Coordinate fake timers with real async operations
- Test actual error propagation

---

### Phase 3: E2E Tests (Future PR - Consider Alternative)
**Files:** 2 files (app, workflows)

**Approach:**
- Evaluate mongodb-memory-server
- Consider if these should remain as-is (valid to mock at service layer for E2E)
- Or enhance with real in-memory database

---

## Technical Notes

### Axios Mocking Pattern
```javascript
jest.mock('axios');
const axios = require('axios');

beforeEach(() => {
  axios.get.mockResolvedValue({
    data: fixtureHtml // or fixture JSON
  });
});
```

### MongoDB Mocking Pattern (TBD)
```javascript
jest.mock('mongodb');
const { MongoClient } = require('mongodb');

// Mock connection, collections, find, insertOne, etc.
```

### Key Considerations:
1. **Fixture Data:** Use existing fixtures in `src/__tests__/fixtures/`
2. **HTML Fixtures:** For ldJsonExtractor, need HTML fixtures with embedded LD+JSON
3. **Error Scenarios:** Mock axios.get to reject for error tests
4. **Database Fixtures:** Use transformer outputs as cached data

---

## Success Criteria

### Phase 1 Complete When:
- ✅ 3 EASY tests use `jest.mock('axios')` instead of business logic mocks
- ✅ All tests pass (npm test)
- ✅ 100% unit test coverage maintained
- ✅ Linting passes (npm run lint)
- ✅ No regressions in other tests

### Overall Success When:
- ✅ All integration tests use real business logic
- ✅ Only HTTP and Database layers are mocked
- ✅ Tests catch real integration issues
- ✅ Test suite runs without errors

---

## Questions for Later Phases

1. **MongoDB Mocking:** Use jest mocks or mongodb-memory-server?
2. **Axios Mock Library:** Use jest.mock or a library like jest-mock-axios?
3. **Fixture Organization:** Create HTML fixtures or generate them?
4. **E2E Tests:** Keep service-layer mocks or use real database?

---

## Status

**Current Phase:** Phase 1 (EASY Wins)
**Files Fixed:** 0 / 3
**Tests Passing:** TBD
**Ready for PR:** NO

---

Last Updated: 2025-10-27
