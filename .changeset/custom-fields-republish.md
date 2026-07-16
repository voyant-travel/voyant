---
"@voyant-travel/custom-fields": patch
---

Republish through the workspace release flow: 0.2.0 was published with raw `catalog:` and `workspace:^` specifiers in its manifest, which npm cannot resolve — any consumer install (including the release tarball verification) fails with EUNSUPPORTEDPROTOCOL.
