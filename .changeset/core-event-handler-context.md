---
"@voyant-travel/core": patch
---

Expose a scheduler-scoped event bus to event handlers so inline subscribers can emit nested events without forcing deferrable downstream subscribers onto the caller path.
