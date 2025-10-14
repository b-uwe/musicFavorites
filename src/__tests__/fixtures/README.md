# MusicBrainz Test Fixtures

This directory contains real MusicBrainz API responses saved as fixtures for testing purposes.

## Critical Relations for Music Events API

Since this API aggregates live music event data, the most important relations are:
- **Bandsintown** (`type: "bandsintown"`)
- **Songkick** (`type: "songkick"`)

These fixtures test various scenarios of missing or present event provider data.

## Fixture Files

### musicbrainz-die-hausfrauen.json
- **Artist:** Die Hausfrauen
- **MBID:** `f35e1992-230b-4d63-9e63-a829caccbcd5`
- **Purpose:** **EXTREME example** of minimal MusicBrainz data
- **Relations:** Only 1 relation (Discogs)
- **Critical Missing Data:**
  - ❌ NO Bandsintown
  - ❌ NO Songkick
  - ❌ NO homepage
  - ❌ NO social media
  - Minimal metadata (no dates, no type, no aliases)

### musicbrainz-jungle-rot.json
- **Artist:** Jungle Rot
- **MBID:** `c2cf194e-24a9-4460-85e0-d7a96a219598`
- **Purpose:** Standard test case with typical relation coverage

### musicbrainz-misery-index.json
- **Artist:** Misery Index
- **MBID:** `c5d423ea-dbf7-4b37-8f8a-25c873ac7ae7`
- **Purpose:** Standard test case with typical relation coverage

### musicbrainz-six-reasons-to-kill.json
- **Artist:** Six Reasons to Kill
- **MBID:** `1e51125d-6e05-47f7-94f7-f4390823f963`
- **Purpose:** Test case for handling artists with **sparse event provider data**
- **Relations:** 11 total relations
- **Critical Missing Data:**
  - ❌ NO Bandsintown (critical for this API!)
  - ✅ HAS Songkick
- **Other Notable Missing:**
  - No streaming services (Spotify, Apple Music, Deezer, Tidal)
  - No modern social media (Twitter, Facebook) - only MySpace
  - No Last.fm, no AllMusic, no image URLs

### musicbrainz-the-kinks.json
- **Artist:** The Kinks
- **MBID:** `17b53d9f-5c63-4a09-a593-dde4608e0db9`
- **Purpose:** Test case with comprehensive relation coverage (48 relations)
- **Features:** Multiple streaming services, social media, databases, aliases, Songkick
- **Note:** Even this well-documented artist may not have Bandsintown

### musicbrainz-watain.json
- **Artist:** Watain
- **MBID:** `9c6862a6-65d9-40b3-b653-9dcb18282e93`
- **Purpose:** Standard test case with typical relation coverage

## Usage

These fixtures are used in unit tests to avoid making live API calls during testing. They represent actual MusicBrainz data at a specific point in time and allow for consistent, reproducible test results.

## Updating Fixtures

To fetch fresh data from MusicBrainz:

```bash
curl "https://musicbrainz.org/ws/2/artist/{MBID}?fmt=json&inc=aliases+url-rels"
```

Replace `{MBID}` with the MusicBrainz ID of the artist.
