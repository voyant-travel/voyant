---
"@voyant-travel/framework-migrations": patch
---

Correct the D.1 framework bundle so it applies cleanly to a blank database: include the `cruise_air_arrangement` enum (via the cruises barrel fix) and inject the `pg_trgm` + `unaccent` extension preamble that the standard schema's trigram/unaccent indexes need (drizzle-kit only auto-generates `postgis`). The bundle's `0000_framework_baseline` now applies end-to-end against Postgres.
