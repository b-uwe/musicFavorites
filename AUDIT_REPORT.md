# Test Architecture Audit Report

**Date:** 2025-10-21
**Auditor:** Claude Code
**Scope:** All test files in `src/__tests__/`

## API Endpoints Identified

From `src/app.js`:
1. `GET /acts/:id` - Single or comma-separated MusicBrainz artist IDs
2. `GET /robots.txt` - Static file serving
3. `404` handler - JSON error responses

---

## Test-by-Test Audit

### Legend
- ✅ **UNIT** - Pure logic, single module, good mocking
- 🔗 **INTEGRATION** - Module interactions, mock only I/O
- 🌐 **E2E** - Full HTTP request→response cycle
- 📊 **COVERAGE** - Hard to test, fills gap, needs documentation
- 🗑️ **TRASH** - Over-mocked, tests mocks not code

---

## File: `app.test.js`

### Test: "returns JSON error for invalid route" (line 22)
- **Category:** 🌐 E2E
- **Mocks:** artistService (E2E should mock only external services)
- **Issue:** Mocks internal module - should use real artistService
- **Action:** Move to e2e/, remove internal mocking

### Test: "returns JSON error for unsupported HTTP method" (line 37)
- **Category:** 🌐 E2E
- **Mocks:** artistService
- **Issue:** Same as above
- **Action:** Move to e2e/, remove internal mocking

### Test: "returns JSON error for root path" (line 50)
- **Category:** 🌐 E2E
- **Mocks:** artistService
- **Issue:** Same as above
- **Action:** Move to e2e/, remove internal mocking

### Test: "returns robots.txt as text/plain" (line 65)
- **Category:** 🌐 E2E
- **Mocks:** None (filesystem is real)
- **Action:** ✅ Move to e2e/ as-is

### Test: "returns single act when given one ID" (line 77)
- **Category:** 🗑️ TRASH
- **Mocks:** artistService.fetchMultipleActs
- **Issue:** Only tests that Express calls mocked function
- **Action:** Delete - will be covered by real E2E test

### Test: "returns multiple acts when given comma-separated IDs" (line 90)
- **Category:** 🗑️ TRASH
- **Mocks:** artistService.fetchMultipleActs
- **Issue:** Same - only tests mock interaction
- **Action:** Delete - will be covered by real E2E test

### Test: "returns 503 error when 2+ acts not cached" (line 102)
- **Category:** 🗑️ TRASH
- **Mocks:** artistService.fetchMultipleActs
- **Issue:** Same - only tests mock interaction
- **Action:** Delete - will be covered by real E2E test

### Test: "handles IDs with whitespace correctly" (line 120)
- **Category:** ✅ UNIT
- **Mocks:** artistService (but testing app.js logic)
- **Issue:** Actually tests whitespace trimming in route handler
- **Action:** Move to unit/routes/ or keep as E2E with real service

### Test: "supports ?pretty query parameter" (line 133)
- **Category:** 🌐 E2E
- **Mocks:** artistService
- **Issue:** Should be E2E with real modules
- **Action:** Move to e2e/, remove internal mocking

### Test: "returns 500 error when fetchMultipleActs throws" (line 143)
- **Category:** 🗑️ TRASH
- **Mocks:** artistService
- **Issue:** Only tests that Express catches errors from mocks
- **Action:** Delete - will be covered by real E2E test

---

## File: `services/artistService.test.js`

### Test: "returns MusicBrainz status when all transformed events have invalid dates" (line 39)
- **Category:** ✅ UNIT
- **Mocks:** None (tests exported pure function)
- **Action:** ✅ Move to unit/services/artistService.test.js

### Test: "throws error when Bandsintown fetch fails and silentFail is undefined" (line 62)
- **Category:** 🔗 INTEGRATION (but currently mocked)
- **Mocks:** ldJsonExtractor
- **Issue:** Should test real module interaction
- **Action:** Create integration test OR keep as unit test for error handling logic

### Test: "does NOT throw when Bandsintown fetch fails and silentFail is true" (line 72)
- **Category:** 🔗 INTEGRATION (but currently mocked)
- **Mocks:** ldJsonExtractor
- **Issue:** Same as above
- **Action:** Same as above

### Test: "returns empty events when Bandsintown fetch fails and silentEventFail=true" (line 86)
- **Category:** 🔗 INTEGRATION (but currently mocked)
- **Mocks:** musicbrainzClient, ldJsonExtractor
- **Issue:** Tests error handling flow across modules
- **Action:** Move to integration/ with only HTTP mocked

### Test: "throws error when Bandsintown fetch fails and silentEventFail=undefined" (line 104)
- **Category:** 🔗 INTEGRATION (but currently mocked)
- **Mocks:** musicbrainzClient, ldJsonExtractor
- **Issue:** Same as above
- **Action:** Move to integration/ with only HTTP mocked

---

## File: `services/artistService.fetchMultiple.test.js`

### Test: "returns error for empty array" (line 36)
- **Category:** ✅ UNIT
- **Mocks:** database, musicbrainzClient, ldJsonExtractor, fetchQueue
- **Action:** ✅ Move to unit/ (input validation is unit logic)

### Test: "returns error for non-array input" (line 46)
- **Category:** ✅ UNIT
- **Mocks:** Same
- **Action:** ✅ Move to unit/

### Test: "returns all acts immediately when all are cached" (line 56)
- **Category:** 🔗 INTEGRATION
- **Mocks:** database, musicbrainzClient, ldJsonExtractor, fetchQueue
- **Issue:** Tests cache hit flow - should use real database module
- **Action:** Move to integration/ (mock only MongoClient)

### Test: "fetches immediately when exactly 1 act is missing" (line 87)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Issue:** Tests cache miss + fetch flow
- **Action:** Move to integration/

### Test: "caches the freshly fetched act when 1 is missing" (line 119)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Issue:** Tests caching after fetch
- **Action:** Move to integration/

### Test: "returns error and triggers background fetch when 2+ acts missing" (line 140)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Issue:** Tests queue triggering logic
- **Action:** Move to integration/

### Test: "triggers background fetch when 2+ missing even with some cached" (line 165)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Action:** Move to integration/

### Test: "formats response with musicbrainzId for single missing act" (line 196)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Action:** Move to integration/

### Test: "continues when caching fails for single missing act" (line 214)
- **Category:** 🔗 INTEGRATION
- **Mocks:** All modules
- **Issue:** Tests error handling - IMPORTANT for resilience
- **Action:** Move to integration/

---

## File: `services/cacheUpdater.test.js`

**Overall Assessment:** This entire file tests with fully mocked database module. This is why the DB reconnection bug wasn't caught!

### All tests in this file (lines 35-662)
- **Category:** 🗑️ TRASH (majority) / 🔗 INTEGRATION (some salvageable)
- **Mocks:** database, musicbrainzClient, ldJsonExtractor (all mocked)
- **Issue:** Tests mock interactions, not real code
- **Critical:** The bug we just fixed (DB reconnection in cacheUpdater.js:42) wasn't caught because database.cacheArtist was mocked!
- **Action:**
  - **TRASH:** Most tests only verify mock calls
  - **SALVAGE:** A few tests for timing/cycle logic could be unit tests
  - **REBUILD:** Need integration tests with real database module (mock only MongoClient)

### Salvageable Unit Tests:
- "uses default cycleIntervalMs when explicitly undefined" (line 377) - ✅ UNIT (tests default parameter logic)
- "includes Berlin timezone updatedAt timestamp" (line 80) - ✅ UNIT (if we extract timestamp function)

---

## File: `services/database.test.js`

### All tests (lines 66-752)
- **Category:** 🔗 INTEGRATION
- **Mocks:** MongoClient only (✅ correct mocking)
- **Action:** ✅ Keep in integration/ - this is how it should be done!
- **Note:** This file does it RIGHT - mocks only external I/O (MongoDB), tests real module logic

---

## File: `services/fetchQueue.test.js`

### All tests (lines 33-263)
- **Category:** 🗑️ TRASH
- **Mocks:** database, musicbrainzClient, ldJsonExtractor (all mocked)
- **Issue:** Same as cacheUpdater - fully mocked, tests nothing real
- **Action:**
  - **TRASH:** Most tests
  - **REBUILD:** Integration tests with real modules (mock only HTTP/MongoDB)

---

## File: `integration/fetchQueue.integration.test.js`

### All tests (lines 33-102)
- **Category:** 🔗 INTEGRATION
- **Mocks:** database, musicbrainzClient, ldJsonExtractor (external I/O)
- **Action:** ✅ Keep in integration/ - this is correct!
- **Note:** This file demonstrates the right approach for integration tests

---

## File: `services/musicbrainz.test.js`

### Test: "fetches artist data successfully" (line 31)
- **Category:** 📊 COVERAGE
- **Mocks:** axios
- **Note:** File self-documents as coverage test (see lines 4-12)
- **Action:** ✅ Move to coverage/ with WHY comment preserved

### Test: "throws backend-specific error when API request fails" (line 48)
- **Category:** 📊 COVERAGE
- **Mocks:** axios
- **Action:** ✅ Move to coverage/

### Test: "handles network timeout with backend prefix" (line 65)
- **Category:** 📊 COVERAGE
- **Mocks:** axios
- **Action:** ✅ Move to coverage/

---

## File: `services/musicbrainzTransformer.test.js`

### All tests (lines 23-268)
- **Category:** ✅ UNIT
- **Mocks:** None (pure transformation functions!)
- **Action:** ✅ Move to unit/ - perfect example of unit tests!
- **Note:** This is the gold standard - pure functions, no mocks, fast tests

---

## File: `services/bandsintownTransformer.test.js`

### All tests (lines 18-553)
- **Category:** ✅ UNIT
- **Mocks:** None (pure transformation functions!)
- **Action:** ✅ Move to unit/ - another gold standard example!

---

## File: `services/ldJsonExtractor.test.js`

### Tests: "extracts single LD+JSON..." through "extracts from real Songkick HTML" (lines 22-129)
- **Category:** ✅ UNIT
- **Mocks:** None (pure extraction logic)
- **Action:** ✅ Move to unit/

### Tests: "returns empty array for unreachable URL" etc. (lines 133-156)
- **Category:** 📊 COVERAGE (or delete)
- **Mocks:** None (real network calls!)
- **Issue:** Makes real HTTP requests - slow, flaky
- **Action:** **DELETE** - these are not reliable tests (network dependent)
- **Alternative:** Mock axios/fetch if we want to test error handling

---

## File: `testHelpers/fixtureModifier.test.js`

### All tests (lines 13-572)
- **Category:** ✅ UNIT
- **Mocks:** None (pure utility functions)
- **Action:** ✅ Move to unit/testHelpers/

---

## Summary Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| ✅ UNIT | ~240 tests | ~60% |
| 🔗 INTEGRATION | ~20 tests | ~5% |
| 🌐 E2E | ~10 tests | ~3% |
| 📊 COVERAGE | ~10 tests | ~3% |
| 🗑️ TRASH | ~120 tests | ~30% |

### Critical Findings

1. **~30% of tests are trash** - They only test mock interactions, not real code
2. **cacheUpdater.test.js is completely mocked** - This is why DB reconnection bug wasn't caught!
3. **fetchQueue.test.js is completely mocked** - Same issue
4. **app.test.js mocks internal modules** - Should be E2E tests
5. **Integration test gap** - Only 2 integration test files exist, need many more
6. **E2E test gap** - No real end-to-end tests of API endpoints

### Files to Delete Entirely

- None - but many individual tests will be deleted

### Files That Need Rebuilding

1. `cacheUpdater.test.js` - Rebuild as integration tests with real database module
2. `fetchQueue.test.js` - Rebuild as integration tests
3. `app.test.js` - Convert to E2E tests, remove internal mocking

### Gold Standard Examples to Learn From

1. ✅ `musicbrainzTransformer.test.js` - Pure unit tests, no mocks
2. ✅ `bandsintownTransformer.test.js` - Pure unit tests, no mocks
3. ✅ `database.test.js` - Integration tests done right (mock only MongoDB)
4. ✅ `integration/fetchQueue.integration.test.js` - Integration pattern

---

## Missing Tests (Gaps)

### Unit Test Gaps
- [ ] Route parameter parsing logic (whitespace trimming)
- [ ] Error message formatting
- [ ] Timestamp generation functions

### Integration Test Gaps
- [ ] **CRITICAL:** cacheUpdater + database (would have caught DB reconnection bug!)
- [ ] **CRITICAL:** cacheUpdater + database with timeouts
- [ ] artistService + database + musicbrainzClient full flow
- [ ] fetchQueue + artistService + database
- [ ] Error propagation across module boundaries

### E2E Test Gaps
- [ ] GET /acts/:id with real modules, cached data
- [ ] GET /acts/:id with real modules, cache miss
- [ ] GET /acts/:id with comma-separated IDs
- [ ] GET /acts/:id error scenarios (invalid ID, service down)
- [ ] Response format validation (JSON structure, attribution)
- [ ] Header validation (Cache-Control, X-Robots-Tag)

---

## Recommendations

### Phase 2 (Unit Tests)
1. Move all transformer tests to `unit/transformers/`
2. Move utility tests to `unit/utilities/`
3. Extract and test pure functions from services
4. Add unit tests for:
   - Input validation logic
   - Data formatting logic
   - Timestamp generation

### Phase 3 (Integration Tests)
**HIGHEST PRIORITY:**
1. Create `integration/cacheUpdater-database.integration.test.js`
   - Test real cacheUpdater calling real database module
   - Mock only MongoClient
   - **This would have caught the DB reconnection bug!**

2. Create `integration/cacheUpdater-timeouts.integration.test.js`
   - Test timeout scenarios with real modules
   - Verify reconnection logic works

3. Create `integration/artistService-full-flow.integration.test.js`
   - Test full fetch + enrich + cache flow
   - Mock only external HTTP and MongoDB

### Phase 4 (E2E Tests)
1. Create `e2e/api-acts-endpoint.e2e.test.js`
   - Real Express app
   - Real request→response cycle
   - Mock only external APIs (MusicBrainz, Bandsintown)

### Phase 5 (Coverage Tests)
1. Move existing coverage tests with documentation
2. Add WHY comments explaining why each is hard to test

### Phase 6 (Cleanup)
1. Delete trash tests
2. Update CLAUDE.md with testing guidelines
3. Add npm scripts: `test:unit`, `test:integration`, `test:e2e`

---

**Next Step:** Await user approval to proceed with Phase 2
