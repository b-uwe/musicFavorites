# Data Notice

This project aggregates publicly available data from third-party services, including (but not limited to) **MusicBrainz**, **Bandsintown**, and **Songkick**.

The maintainers of this project do **not** own or claim ownership of any data provided by these sources.
All data remains subject to the terms, licenses, and usage policies of their respective owners.

## Your Responsibilities

**If you use this software or its API, you must:**

1. **Comply with upstream terms:** Respect the terms of service of MusicBrainz, Bandsintown, and Songkick
2. **Provide attribution:** Credit the original data sources in your application
3. **Respect rate limits:** Do not abuse the upstream services through this aggregation layer. This implementation includes caching to minimize upstream requests, and you should maintain similar protections in any fork.
4. **Monitor compliance:** Regularly check that your use complies with upstream provider terms

## Third-Party Data Attribution

Data in this project originates from the following sources:

- **MusicBrainz** — [https://musicbrainz.org](https://musicbrainz.org)
- **Bandsintown** — [https://www.bandsintown.com](https://www.bandsintown.com)
- **Songkick** — [https://www.songkick.com](https://www.songkick.com)

We thank these services for providing publicly accessible music event data.

## License Notice

The **code and API implementation** of this project are licensed under [AGPL-3.0](LICENSE).
This license covers the software itself, not the third-party data it aggregates.

See [API_SCHEMA_LICENSE.md](API_SCHEMA_LICENSE.md) for more details.
