# Music Favorites API

**Music Favorites** is a Node.js project that aggregates publicly available data on music acts, concerts, and festivals from multiple sources — including **MusicBrainz**, **Bandsintown**, and **Songkick** — into a unified API.  
This project is fully open-source and designed for **educational and non-commercial use**.

---

## Features

- Aggregate concert and festival data from multiple public sources.
- Expose a consistent REST API for querying artists, events, and venues.
- Standardized data schema and aggregation logic for easy consumption.
- Open for community contributions while keeping all code under **AGPLv3**.

---

## Getting Started

### Prerequisites

- Node.js v24+
- npm or yarn  

### Installation

```bash
git clone https://github.com/yourusername/music-favorites-api.git
cd music-favorites-api
npm install
```

### Running the API

```bash
npm start
```

## API Documentation

### GET /acts/:id

Retrieve information about one or more music acts.

#### Single Act Request

```bash
curl "http://localhost:3000/acts/53689c08-f234-4c47-9256-58c8568f06d1"
```

**Response Format:**
```json
{
  "meta": {
    "attribution": {
      "sources": ["MusicBrainz", "Bandsintown", "Songkick"],
      "notice": "Data from third-party sources subject to their respective terms..."
    },
    "license": "AGPL-3.0",
    "repository": "https://github.com/b-uwe/musicFavorites"
  },
  "type": "acts",
  "acts": [
    {
      "musicbrainzId": "53689c08-f234-4c47-9256-58c8568f06d1",
      "name": "Jungle Rot",
      ...
    }
  ]
}
```

#### Multiple Acts Request

Request multiple acts by separating MusicBrainz IDs with commas:

```bash
curl "http://localhost:3000/acts/53689c08-f234-4c47-9256-58c8568f06d1,f35e1992-230b-4d63-9e63-a829caccbcd5"
```

**Smart Caching Behavior:**
- **All cached**: Returns immediately with all acts
- **Exactly 1 missing**: Fetches the missing act immediately and returns all acts
- **2+ missing**: Returns error immediately and fetches all missing acts in background (with 30-second delays between fetches)

**Response Format (Success):**
```json
{
  "meta": { ... },
  "type": "acts",
  "acts": [
    { "musicbrainzId": "...", ... },
    { "musicbrainzId": "...", ... }
  ]
}
```

**Response Format (2+ Acts Missing from Cache):**
```json
{
  "type": "error",
  "error": {
    "message": "Failed to fetch artist data",
    "details": "2 acts not found in cache! Updating in the background! Please retry in a few minutes"
  }
}
```

#### Query Parameters

- `?pretty` - Enable pretty-printed JSON output

**Example:**
```bash
curl "http://localhost:3000/acts/53689c08-f234-4c47-9256-58c8568f06d1?pretty"
```

## Third-Party Data

This project aggregates publicly available data from:

- MusicBrainz — https://musicbrainz.org
- Bandsintown — https://www.bandsintown.com
- Songkick — https://www.songkick.com

The maintainers of this project do **not** own or claim ownership of any data provided by these sources.

Please see DATA_NOTICE.md for full disclaimers, terms, and attribution requirements.

## Contributing

Contributions are very welcome!

All contributions must be compatible with the AGPLv3 license.

## License

This project is licensed under **AGPL-3.0** (see [LICENSE](LICENSE)).

**Important:** While the code is AGPL-3.0, the third-party data aggregated by this service remains subject to the terms of the original providers (MusicBrainz, Bandsintown, Songkick). See [DATA_NOTICE.md](DATA_NOTICE.md) for details on your responsibilities when using this software.

## Disclaimer

This project is provided as is, without any warranty.

The maintainers are not responsible for the accuracy or availability of third-party data.
