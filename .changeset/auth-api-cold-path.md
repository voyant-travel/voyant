---
"@voyant-travel/worker-runtime": patch
---

Keep lean auth dispatch isolated from the full API graph by default. Auth
requests no longer background-warm `loadApiApp()` unless a host explicitly sets
`warmApiOnAuth: true`, preventing `/api/auth/*` cold requests from triggering
the heavy framework module import path.
