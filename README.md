# Music Favorites API

**Music Favorites** is a Node.js project that aggregates publicly available data on music acts, concerts, and festivals from multiple sources — including **MusicBrainz**, **Bandsintown**, and **Songkick** — into a unified API.  
This project is fully open-source and designed for **educational and non-commercial use**.

---

## Features

- Aggregate concert and festival data from multiple public sources.
- Expose a consistent REST API for querying acts, events, and venues.
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

### Configuration

The application requires the following environment variables:

#### Required

- `MONGODB_URI` - MongoDB connection string (e.g., `mongodb+srv://username:password@cluster.example.mongodb.net/?retryWrites=true&w=majority`)
- `ADMIN_PASS` - Password for admin endpoint authentication (e.g., `my-secret-password`)
- `ADMIN_TOTP_CONFIG` - TOTP configuration as JSON string (e.g., `{"secret":"YOUR32CHARBASE32SECRETHERE","encoding":"base32","algorithm":"sha1"}`)

#### Optional

- `PORT` - Server port (defaults to 3000)

### Running the API

```bash
npm start
```

## API Documentation

Endpoints are documented with request and response examples.

### Admin Endpoint

The `/admin/health` endpoint provides health and usage statistics. Authentication requires two environment variables to be set like this:
```bash
ADMIN_PASS="SUPERSECRET"
ADMIN_TOTP_CONFIG='{"secret":"ZSMP26YRTHY7YNJ76KJ3ZSMP26YRTHY7","encoding":"base32","algorithm":"sha1"}'
```

Authorization header format:
```
Authorization: pass SUPERSECRET, bearer <totp-code>
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
