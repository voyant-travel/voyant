# @voyant-travel/observability-sentry

## 0.5.0

### Patch Changes

- Updated dependencies [86fbb05]
  - @voyant-travel/hono@0.119.0

## 0.4.0

### Patch Changes

- Updated dependencies [9a1197b]
  - @voyant-travel/hono@0.118.0

## 0.3.0

### Patch Changes

- Updated dependencies [7c5ee80]
  - @voyant-travel/hono@0.117.0

## 0.2.1

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/hono@0.116.2

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
