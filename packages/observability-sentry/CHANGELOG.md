# @voyant-travel/observability-sentry

## 0.2.0

### Patch Changes

- Updated dependencies [684b321]
- Updated dependencies [2542715]
  - @voyant-travel/hono@0.116.0

## 0.1.0

### Minor Changes

- 479c191: Add `@voyant-travel/observability-sentry`: a first-party Sentry adapter for the observability `Reporter` seam (RFC voyant#1553). `sentryReporter(sentry)` forwards normalized error events to an already-initialized Sentry client — tagging each with the user-facing `requestId` and flushing via the framework's `waitUntil` — without this package depending on any Sentry SDK (it binds to a structural `SentryLike` interface).

### Patch Changes

- Updated dependencies [04b257c]
- Updated dependencies [78c15fa]
  - @voyant-travel/hono@0.115.0
