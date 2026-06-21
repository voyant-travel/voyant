---
"@voyant-travel/distribution": patch
---

Handle scheduled channel availability and content push runs that provide no input payload.

The channel push processors now treat `null` workflow input the same as absent input, preserving the default drain limit and all-channel scope. Scheduled availability/content push workflow concurrency keys also fall back to `all` when no payload is supplied.
