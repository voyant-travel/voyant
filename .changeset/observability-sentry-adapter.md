---
"@voyant-travel/observability-sentry": minor
---

Add `@voyant-travel/observability-sentry`: a first-party Sentry adapter for the observability `Reporter` seam (RFC voyant#1553). `sentryReporter(sentry)` forwards normalized error events to an already-initialized Sentry client — tagging each with the user-facing `requestId` and flushing via the framework's `waitUntil` — without this package depending on any Sentry SDK (it binds to a structural `SentryLike` interface).
