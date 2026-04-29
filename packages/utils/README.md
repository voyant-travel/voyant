# @voyantjs/utils

Shared utility functions for Voyant. Caching, KMS, KV, rate limits, session claims, and localized geographic data (countries, currencies, languages, timezones, regions).

## Install

```bash
pnpm add @voyantjs/utils
```

## Usage

```typescript
import { cached } from "@voyantjs/utils/cache"
import { COUNTRIES } from "@voyantjs/utils/countries"
import { CURRENCIES } from "@voyantjs/utils/currencies"
import { TIMEZONES } from "@voyantjs/utils/timezones"

const result = await cached(key, ttlSeconds, computeFn, kv)
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./cache` | KV-backed `cached(key, ttl, fn, kv)` helper |
| `./kv` | KV wrapper utilities |
| `./kms` | KMS envelope encryption (GCP + local providers) |
| `./session-claims` | Session-claim helpers |
| `./rate-limits` | Rate-limit primitives |
| `./countries` | ISO country data |
| `./currencies` | ISO currency data |
| `./languages` | ISO language data |
| `./timezones` | IANA timezone data |
| `./geographic-regions` | Region taxonomies |
| `./localized-countries-regions` | Localized country/region data |
| `./localized-regions` | Localized region data |

## License

Apache-2.0
