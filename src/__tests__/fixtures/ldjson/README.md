# LD+JSON Test Fixtures

This directory contains real-world HTML and extracted JSON-LD data from music event provider websites.

## Purpose

- **HTML files**: Used to test the LD+JSON extraction logic against real website markup
- **JSON files**: Pre-extracted LD+JSON data for testing transformation/integration logic in isolation

## Fixtures

### Bandsintown
- **Source**: https://www.bandsintown.com/a/6461184
- **Artist**: Six Reasons to Kill (example artist)
- **Captured**: 2025-10-14
- **Files**:
  - `bandsintown-artist-6461184.html` (472KB)
  - `bandsintown-artist-6461184.json` (3 LD+JSON blocks)

### Festivals United
- **Source**: https://www.festivalsunited.com/festivals/alcatraz-metal-festival
- **Event**: Alcatraz Metal Festival
- **Captured**: 2025-10-14
- **Files**:
  - `festivalsunited-alcatraz.html` (174KB)
  - `festivalsunited-alcatraz.json` (1 LD+JSON block)

### Songkick
- **Source**: https://www.songkick.com/artists/277414-anaal-nathrakh
- **Artist**: Anaal Nathrakh
- **Captured**: 2025-10-14
- **Files**:
  - `songkick-anaal-nathrakh.html` (117KB)
  - `songkick-anaal-nathrakh.json` (6 LD+JSON blocks)

## Usage

### In extraction tests
```javascript
const fs = require('fs');
const html = fs.readFileSync('fixtures/ldjson/bandsintown-artist-6461184.html', 'utf8');
const result = extractLdJson(html);
// Validate against bandsintown-artist-6461184.json
```

### In transformation tests
```javascript
const expected = require('fixtures/ldjson/bandsintown-artist-6461184.json');
// Use pre-extracted JSON to test transformation logic in isolation
```

## Maintenance

These fixtures are snapshots from live websites. If tests fail:
1. Check if the website structure has changed
2. Verify the extraction logic is still correct
3. Update fixtures if necessary by re-fetching from source URLs
