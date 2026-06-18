---
"@voyant-travel/framework-migrations": patch
---

Stop shipping drizzle-kit `meta/*_snapshot.json` files in the published package. The bundle loader (`loadFrameworkBundleSource` → `loadMigrationFolder`) only reads `meta/_journal.json` + the `*.sql` files at runtime; the per-migration snapshots are build-time drift-detection artifacts used only inside the repo. Narrowing `files` to `dist`, `migrations/*.sql`, and `migrations/meta/_journal.json` cuts the published package from ~9.8 MB unpacked (469 kB tarball) to ~0.53 MB (60 kB) with no runtime change.
