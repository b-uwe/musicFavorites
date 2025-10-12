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

Endpoints are documented with request and response examples.

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
