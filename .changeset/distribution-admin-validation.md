---
"@voyant-travel/distribution": patch
---

Validate distribution admin booking links and webhook events before insert so dangling references return stable 4xx API errors, while keeping product mappings compatible with unmanaged product references.
