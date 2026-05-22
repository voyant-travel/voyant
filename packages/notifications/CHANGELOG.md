# @voyantjs/notifications

## 0.73.1

### Patch Changes

- @voyantjs/bookings@0.73.1
- @voyantjs/core@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/finance@0.73.1
- @voyantjs/hono@0.73.1
- @voyantjs/legal@0.73.1

## 0.73.0

### Patch Changes

- Updated dependencies [856da86]
  - @voyantjs/bookings@0.73.0
  - @voyantjs/core@0.73.0
  - @voyantjs/db@0.73.0
  - @voyantjs/finance@0.73.0
  - @voyantjs/hono@0.73.0
  - @voyantjs/legal@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/bookings@0.72.0
- @voyantjs/core@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/finance@0.72.0
- @voyantjs/hono@0.72.0
- @voyantjs/legal@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/bookings@0.71.0
- @voyantjs/core@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/finance@0.71.0
- @voyantjs/hono@0.71.0
- @voyantjs/legal@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/bookings@0.70.0
- @voyantjs/core@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/finance@0.70.0
- @voyantjs/hono@0.70.0
- @voyantjs/legal@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/bookings@0.69.1
- @voyantjs/core@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/finance@0.69.1
- @voyantjs/hono@0.69.1
- @voyantjs/legal@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/bookings@0.69.0
- @voyantjs/core@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/finance@0.69.0
- @voyantjs/hono@0.69.0
- @voyantjs/legal@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/bookings@0.68.0
- @voyantjs/core@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/finance@0.68.0
- @voyantjs/hono@0.68.0
- @voyantjs/legal@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/bookings@0.67.0
- @voyantjs/core@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/finance@0.67.0
- @voyantjs/hono@0.67.0
- @voyantjs/legal@0.67.0

## 0.66.6

### Patch Changes

- Updated dependencies [2a40d26]
  - @voyantjs/bookings@0.66.6
  - @voyantjs/core@0.66.6
  - @voyantjs/db@0.66.6
  - @voyantjs/finance@0.66.6
  - @voyantjs/hono@0.66.6
  - @voyantjs/legal@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyantjs/bookings@0.66.5
  - @voyantjs/core@0.66.5
  - @voyantjs/db@0.66.5
  - @voyantjs/finance@0.66.5
  - @voyantjs/hono@0.66.5
  - @voyantjs/legal@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyantjs/bookings@0.66.4
  - @voyantjs/core@0.66.4
  - @voyantjs/db@0.66.4
  - @voyantjs/finance@0.66.4
  - @voyantjs/hono@0.66.4
  - @voyantjs/legal@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/bookings@0.66.3
- @voyantjs/core@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/finance@0.66.3
- @voyantjs/hono@0.66.3
- @voyantjs/legal@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/bookings@0.66.2
- @voyantjs/core@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/finance@0.66.2
- @voyantjs/hono@0.66.2
- @voyantjs/legal@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/bookings@0.66.1
- @voyantjs/core@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/finance@0.66.1
- @voyantjs/hono@0.66.1
- @voyantjs/legal@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/bookings@0.66.0
- @voyantjs/core@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/finance@0.66.0
- @voyantjs/hono@0.66.0
- @voyantjs/legal@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/bookings@0.65.0
- @voyantjs/core@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/finance@0.65.0
- @voyantjs/hono@0.65.0
- @voyantjs/legal@0.65.0

## 0.64.1

### Patch Changes

- 572dde4: Add configurable customer-facing payment-link base URLs for generated links and notification template context.
- Updated dependencies [572dde4]
  - @voyantjs/bookings@0.64.1
  - @voyantjs/core@0.64.1
  - @voyantjs/db@0.64.1
  - @voyantjs/finance@0.64.1
  - @voyantjs/hono@0.64.1
  - @voyantjs/legal@0.64.1

## 0.64.0

### Patch Changes

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.
- Updated dependencies [6d0c8f3]
  - @voyantjs/bookings@0.64.0
  - @voyantjs/core@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/finance@0.64.0
  - @voyantjs/hono@0.64.0
  - @voyantjs/legal@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/bookings@0.63.1
- @voyantjs/core@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/finance@0.63.1
- @voyantjs/hono@0.63.1
- @voyantjs/legal@0.63.1

## 0.63.0

### Patch Changes

- Updated dependencies [5bff9c3]
- Updated dependencies [5bff9c3]
  - @voyantjs/bookings@0.63.0
  - @voyantjs/core@0.63.0
  - @voyantjs/db@0.63.0
  - @voyantjs/finance@0.63.0
  - @voyantjs/hono@0.63.0
  - @voyantjs/legal@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/bookings@0.62.3
- @voyantjs/core@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/finance@0.62.3
- @voyantjs/hono@0.62.3
- @voyantjs/legal@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/bookings@0.62.2
- @voyantjs/core@0.62.2
- @voyantjs/db@0.62.2
- @voyantjs/finance@0.62.2
- @voyantjs/hono@0.62.2
- @voyantjs/legal@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/bookings@0.62.1
- @voyantjs/core@0.62.1
- @voyantjs/db@0.62.1
- @voyantjs/finance@0.62.1
- @voyantjs/hono@0.62.1
- @voyantjs/legal@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyantjs/bookings@0.62.0
  - @voyantjs/core@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/finance@0.62.0
  - @voyantjs/hono@0.62.0
  - @voyantjs/legal@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/bookings@0.61.0
- @voyantjs/core@0.61.0
- @voyantjs/db@0.61.0
- @voyantjs/finance@0.61.0
- @voyantjs/hono@0.61.0
- @voyantjs/legal@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/bookings@0.60.0
- @voyantjs/core@0.60.0
- @voyantjs/db@0.60.0
- @voyantjs/finance@0.60.0
- @voyantjs/hono@0.60.0
- @voyantjs/legal@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/bookings@0.59.0
- @voyantjs/core@0.59.0
- @voyantjs/db@0.59.0
- @voyantjs/finance@0.59.0
- @voyantjs/hono@0.59.0
- @voyantjs/legal@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/bookings@0.58.0
- @voyantjs/core@0.58.0
- @voyantjs/db@0.58.0
- @voyantjs/finance@0.58.0
- @voyantjs/hono@0.58.0
- @voyantjs/legal@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/bookings@0.57.0
- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/finance@0.57.0
- @voyantjs/hono@0.57.0
- @voyantjs/legal@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/bookings@0.56.0
- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/finance@0.56.0
- @voyantjs/hono@0.56.0
- @voyantjs/legal@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/bookings@0.55.1
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/finance@0.55.1
  - @voyantjs/hono@0.55.1
  - @voyantjs/legal@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/bookings@0.55.0
- @voyantjs/core@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/finance@0.55.0
- @voyantjs/hono@0.55.0
- @voyantjs/legal@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyantjs/bookings@0.54.0
  - @voyantjs/core@0.54.0
  - @voyantjs/db@0.54.0
  - @voyantjs/finance@0.54.0
  - @voyantjs/hono@0.54.0
  - @voyantjs/legal@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/bookings@0.53.2
- @voyantjs/core@0.53.2
- @voyantjs/db@0.53.2
- @voyantjs/finance@0.53.2
- @voyantjs/hono@0.53.2
- @voyantjs/legal@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/bookings@0.53.1
- @voyantjs/core@0.53.1
- @voyantjs/db@0.53.1
- @voyantjs/finance@0.53.1
- @voyantjs/hono@0.53.1
- @voyantjs/legal@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [a315df6]
  - @voyantjs/bookings@0.53.0
  - @voyantjs/core@0.53.0
  - @voyantjs/db@0.53.0
  - @voyantjs/finance@0.53.0
  - @voyantjs/hono@0.53.0
  - @voyantjs/legal@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/bookings@0.52.4
  - @voyantjs/core@0.52.4
  - @voyantjs/db@0.52.4
  - @voyantjs/finance@0.52.4
  - @voyantjs/hono@0.52.4
  - @voyantjs/legal@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/bookings@0.52.3
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/finance@0.52.3
  - @voyantjs/hono@0.52.3
  - @voyantjs/legal@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Quiet/auxiliary updates.

  - `@voyantjs/notifications`: `booking.confirmed` subscriber honors a new `suppressNotifications` flag on the event payload so operators can confirm a booking without firing the customer-facing email/doc bundle (data corrections, manual hand-offs).
  - `@voyantjs/customer-portal`: public service + validation tightened around the new booking tax-preview shape; integration tests updated to assert the new response.
  - `@voyantjs/i18n`: new admin strings for the bookings billing dialog, finance tax-preview labels, CRM operator screens, and products operator surface (EN + RO).

- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
  - @voyantjs/bookings@0.52.2
  - @voyantjs/core@0.52.2
  - @voyantjs/db@0.52.2
  - @voyantjs/finance@0.52.2
  - @voyantjs/hono@0.52.2
  - @voyantjs/legal@0.52.2

## 0.52.1

### Patch Changes

- Updated dependencies [335d277]
  - @voyantjs/bookings@0.52.1
  - @voyantjs/core@0.52.1
  - @voyantjs/db@0.52.1
  - @voyantjs/finance@0.52.1
  - @voyantjs/hono@0.52.1
  - @voyantjs/legal@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/bookings@0.52.0
- @voyantjs/core@0.52.0
- @voyantjs/db@0.52.0
- @voyantjs/finance@0.52.0
- @voyantjs/hono@0.52.0
- @voyantjs/legal@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/bookings@0.51.1
- @voyantjs/core@0.51.1
- @voyantjs/db@0.51.1
- @voyantjs/finance@0.51.1
- @voyantjs/hono@0.51.1
- @voyantjs/legal@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/bookings@0.51.0
- @voyantjs/core@0.51.0
- @voyantjs/db@0.51.0
- @voyantjs/finance@0.51.0
- @voyantjs/hono@0.51.0
- @voyantjs/legal@0.51.0

## 0.50.8

### Patch Changes

- Updated dependencies [f35014f]
  - @voyantjs/bookings@0.50.8
  - @voyantjs/core@0.50.8
  - @voyantjs/db@0.50.8
  - @voyantjs/finance@0.50.8
  - @voyantjs/hono@0.50.8
  - @voyantjs/legal@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/bookings@0.50.7
- @voyantjs/core@0.50.7
- @voyantjs/db@0.50.7
- @voyantjs/finance@0.50.7
- @voyantjs/hono@0.50.7
- @voyantjs/legal@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/bookings@0.50.6
  - @voyantjs/core@0.50.6
  - @voyantjs/db@0.50.6
  - @voyantjs/finance@0.50.6
  - @voyantjs/hono@0.50.6
  - @voyantjs/legal@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/bookings@0.50.5
- @voyantjs/core@0.50.5
- @voyantjs/db@0.50.5
- @voyantjs/finance@0.50.5
- @voyantjs/hono@0.50.5
- @voyantjs/legal@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/bookings@0.50.4
- @voyantjs/core@0.50.4
- @voyantjs/db@0.50.4
- @voyantjs/finance@0.50.4
- @voyantjs/hono@0.50.4
- @voyantjs/legal@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/bookings@0.50.3
- @voyantjs/core@0.50.3
- @voyantjs/db@0.50.3
- @voyantjs/finance@0.50.3
- @voyantjs/hono@0.50.3
- @voyantjs/legal@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/bookings@0.50.2
- @voyantjs/core@0.50.2
- @voyantjs/db@0.50.2
- @voyantjs/finance@0.50.2
- @voyantjs/hono@0.50.2
- @voyantjs/legal@0.50.2

## 0.50.1

### Patch Changes

- Updated dependencies [7b768c5]
  - @voyantjs/bookings@0.50.1
  - @voyantjs/core@0.50.1
  - @voyantjs/db@0.50.1
  - @voyantjs/finance@0.50.1
  - @voyantjs/hono@0.50.1
  - @voyantjs/legal@0.50.1

## 0.50.0

### Patch Changes

- Updated dependencies [140d0ad]
  - @voyantjs/bookings@0.50.0
  - @voyantjs/core@0.50.0
  - @voyantjs/db@0.50.0
  - @voyantjs/finance@0.50.0
  - @voyantjs/hono@0.50.0
  - @voyantjs/legal@0.50.0

## 0.49.0

### Minor Changes

- 3029f10: Add first-class booking document-bundle lifecycle hooks for confirmation and fully-paid transitions, with default legal/finance bundle composition and host-overridable notification policy.

### Patch Changes

- @voyantjs/bookings@0.49.0
- @voyantjs/core@0.49.0
- @voyantjs/db@0.49.0
- @voyantjs/finance@0.49.0
- @voyantjs/hono@0.49.0
- @voyantjs/legal@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/bookings@0.48.0
- @voyantjs/core@0.48.0
- @voyantjs/db@0.48.0
- @voyantjs/finance@0.48.0
- @voyantjs/hono@0.48.0
- @voyantjs/legal@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyantjs/bookings@0.47.0
  - @voyantjs/core@0.47.0
  - @voyantjs/db@0.47.0
  - @voyantjs/finance@0.47.0
  - @voyantjs/hono@0.47.0
  - @voyantjs/legal@0.47.0

## 0.46.0

### Patch Changes

- Updated dependencies [72b99b2]
  - @voyantjs/bookings@0.46.0
  - @voyantjs/core@0.46.0
  - @voyantjs/db@0.46.0
  - @voyantjs/finance@0.46.0
  - @voyantjs/hono@0.46.0
  - @voyantjs/legal@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/bookings@0.45.0
- @voyantjs/core@0.45.0
- @voyantjs/db@0.45.0
- @voyantjs/finance@0.45.0
- @voyantjs/hono@0.45.0
- @voyantjs/legal@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/bookings@0.44.0
- @voyantjs/core@0.44.0
- @voyantjs/db@0.44.0
- @voyantjs/finance@0.44.0
- @voyantjs/hono@0.44.0
- @voyantjs/legal@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/bookings@0.43.0
  - @voyantjs/core@0.43.0
  - @voyantjs/db@0.43.0
  - @voyantjs/finance@0.43.0
  - @voyantjs/hono@0.43.0
  - @voyantjs/legal@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [786945f]
  - @voyantjs/bookings@0.42.0
  - @voyantjs/core@0.42.0
  - @voyantjs/db@0.42.0
  - @voyantjs/finance@0.42.0
  - @voyantjs/hono@0.42.0
  - @voyantjs/legal@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/bookings@0.41.3
- @voyantjs/core@0.41.3
- @voyantjs/db@0.41.3
- @voyantjs/finance@0.41.3
- @voyantjs/hono@0.41.3
- @voyantjs/legal@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/bookings@0.41.2
- @voyantjs/core@0.41.2
- @voyantjs/db@0.41.2
- @voyantjs/finance@0.41.2
- @voyantjs/hono@0.41.2
- @voyantjs/legal@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/bookings@0.41.1
- @voyantjs/core@0.41.1
- @voyantjs/db@0.41.1
- @voyantjs/finance@0.41.1
- @voyantjs/hono@0.41.1
- @voyantjs/legal@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/bookings@0.41.0
- @voyantjs/core@0.41.0
- @voyantjs/db@0.41.0
- @voyantjs/finance@0.41.0
- @voyantjs/hono@0.41.0
- @voyantjs/legal@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/bookings@0.40.1
- @voyantjs/core@0.40.1
- @voyantjs/db@0.40.1
- @voyantjs/finance@0.40.1
- @voyantjs/hono@0.40.1
- @voyantjs/legal@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/bookings@0.40.0
- @voyantjs/core@0.40.0
- @voyantjs/db@0.40.0
- @voyantjs/finance@0.40.0
- @voyantjs/hono@0.40.0
- @voyantjs/legal@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
- Updated dependencies [2297949]
  - @voyantjs/bookings@0.39.0
  - @voyantjs/core@0.39.0
  - @voyantjs/db@0.39.0
  - @voyantjs/finance@0.39.0
  - @voyantjs/hono@0.39.0
  - @voyantjs/legal@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/bookings@0.38.2
- @voyantjs/core@0.38.2
- @voyantjs/db@0.38.2
- @voyantjs/finance@0.38.2
- @voyantjs/hono@0.38.2
- @voyantjs/legal@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/bookings@0.38.1
- @voyantjs/core@0.38.1
- @voyantjs/db@0.38.1
- @voyantjs/finance@0.38.1
- @voyantjs/hono@0.38.1
- @voyantjs/legal@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/bookings@0.38.0
- @voyantjs/core@0.38.0
- @voyantjs/db@0.38.0
- @voyantjs/finance@0.38.0
- @voyantjs/hono@0.38.0
- @voyantjs/legal@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/bookings@0.37.1
- @voyantjs/core@0.37.1
- @voyantjs/db@0.37.1
- @voyantjs/finance@0.37.1
- @voyantjs/hono@0.37.1
- @voyantjs/legal@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
  - @voyantjs/bookings@0.37.0
  - @voyantjs/core@0.37.0
  - @voyantjs/db@0.37.0
  - @voyantjs/finance@0.37.0
  - @voyantjs/hono@0.37.0
  - @voyantjs/legal@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [15e6953]
  - @voyantjs/bookings@0.36.0
  - @voyantjs/core@0.36.0
  - @voyantjs/db@0.36.0
  - @voyantjs/finance@0.36.0
  - @voyantjs/hono@0.36.0
  - @voyantjs/legal@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/bookings@0.35.0
- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/finance@0.35.0
- @voyantjs/hono@0.35.0
- @voyantjs/legal@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [9095837]
- Updated dependencies [6e4a90f]
- Updated dependencies [24b6624]
- Updated dependencies [a37d4af]
  - @voyantjs/bookings@0.34.0
  - @voyantjs/core@0.34.0
  - @voyantjs/db@0.34.0
  - @voyantjs/finance@0.34.0
  - @voyantjs/hono@0.34.0
  - @voyantjs/legal@0.34.0

## 0.33.1

### Patch Changes

- Updated dependencies [9bee9aa]
  - @voyantjs/bookings@0.33.1
  - @voyantjs/core@0.33.1
  - @voyantjs/db@0.33.1
  - @voyantjs/finance@0.33.1
  - @voyantjs/hono@0.33.1
  - @voyantjs/legal@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/bookings@0.33.0
- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/finance@0.33.0
- @voyantjs/hono@0.33.0
- @voyantjs/legal@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/bookings@0.32.3
- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/finance@0.32.3
- @voyantjs/hono@0.32.3
- @voyantjs/legal@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/bookings@0.32.2
- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/finance@0.32.2
- @voyantjs/hono@0.32.2
- @voyantjs/legal@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/bookings@0.32.1
- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/finance@0.32.1
- @voyantjs/hono@0.32.1
- @voyantjs/legal@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/bookings@0.32.0
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/finance@0.32.0
  - @voyantjs/hono@0.32.0
  - @voyantjs/legal@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/bookings@0.31.4
- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/finance@0.31.4
- @voyantjs/hono@0.31.4
- @voyantjs/legal@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/bookings@0.31.3
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/finance@0.31.3
  - @voyantjs/hono@0.31.3
  - @voyantjs/legal@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/bookings@0.31.2
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/finance@0.31.2
  - @voyantjs/hono@0.31.2
  - @voyantjs/legal@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/bookings@0.31.1
- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/finance@0.31.1
- @voyantjs/hono@0.31.1
- @voyantjs/legal@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/bookings@0.31.0
- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/finance@0.31.0
- @voyantjs/hono@0.31.0
- @voyantjs/legal@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/bookings@0.30.7
- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/finance@0.30.7
- @voyantjs/hono@0.30.7
- @voyantjs/legal@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/bookings@0.30.6
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/finance@0.30.6
  - @voyantjs/hono@0.30.6
  - @voyantjs/legal@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/bookings@0.30.5
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/finance@0.30.5
  - @voyantjs/hono@0.30.5
  - @voyantjs/legal@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/bookings@0.30.4
- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/finance@0.30.4
- @voyantjs/hono@0.30.4
- @voyantjs/legal@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/bookings@0.30.3
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/finance@0.30.3
  - @voyantjs/hono@0.30.3
  - @voyantjs/legal@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/bookings@0.30.2
- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/finance@0.30.2
- @voyantjs/hono@0.30.2
- @voyantjs/legal@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/bookings@0.30.1
- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/finance@0.30.1
- @voyantjs/hono@0.30.1
- @voyantjs/legal@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/bookings@0.30.0
- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/finance@0.30.0
- @voyantjs/hono@0.30.0
- @voyantjs/legal@0.30.0

## 0.29.0

### Minor Changes

- 4a6523e: Drop legacy single-offset reminder path; polish channel editor (#488).

  Stage channel editor:

  - Replaces the two free-text "Template id / Template slug" fields with
    a single async `<TemplatePicker>` (typeahead via `AsyncCombobox`)
    filtered by the channel selected at the top of the dialog. Picking
    a template now resolves to the template id directly — no more
    guessing slugs. Switching channel clears the picked template since
    the next list will be filtered.
  - Provider becomes a `<Select>` with **Automatic** / **Resend
    (email)** / **Twilio (SMS)** options. "Automatic" maps to `null`
    (use the deployment default for that channel).
  - Drops the freeform "Recipient role" field. Recipient resolution is
    driven by the booking's primary contact / first traveler today;
    the role tag wasn't actually consulted by the dispatcher.

  Backend cleanup (we're in beta — no users, no compat needed):

  - Drops the `relative_days_from_due_date` column from
    `notification_reminder_rules` (migration
    `0003_drop_legacy_columns.sql`).
  - Drops the `holiday_calendar` column from `notification_settings`
    (UI was already gone; the underlying public-holidays integration is
    out of scope for this iteration).
  - Removes the legacy single-offset dispatcher path entirely:
    `queueDueReminders` and `runDueReminders` now delegate straight to
    the stage-aware versions, and the four legacy helpers
    (`queueBookingPaymentScheduleReminder`,
    `queueInvoiceReminder`, `sendBookingPaymentScheduleReminder`,
    `sendInvoiceReminder`) plus the `ruleHasStages` skip check are
    deleted. Net ~500 lines removed from `service-reminders.ts`.
  - `relativeDaysFromDueDate` removed from validation, the run-summary
    schema, the notifications-react record schema, the operator
    template detail page, the legacy rule dialog, and the checkout
    service's reminder-runs join projection.
  - Legacy integration tests `reminders.test.ts` and
    `reminder-tasks.test.ts` are deleted; the stage-based
    `reminder-sequences.test.ts` covers the path that survives.

- 4a6523e: Add reminder sequences: stages, channels, and notification settings (#488).

  Reminder rules can now own an ordered list of **stages**, each with its own anchor (`due_date`, `booking_created_at`, `departure_date`, `invoice_issued_at`, or `last_send_at`), eligibility window (`[startDays, endDays]`), and cadence (`once`, `every_n_days`, or `escalating` with `daysUntilDueGT/LT` buckets). Each stage can fan out to multiple channels, each carrying its own template and recipient kind. This subsumes the legacy single-offset rule (one stage, `cadence: once`, anchor `due_date`) and the counter-based escalation pattern from the issue (one stage with `cadence: escalating(...)` plus sibling stages keyed on cumulative `maxSendsInStage`).

  The dispatcher gains a stage-aware path that runs first; rules without stages fall through to the legacy date-offset path (back-compat). The migration creates one stage + one channel per existing rule mirroring the legacy behavior, so existing fires keep working unchanged.

  New tables: `notification_reminder_rule_stages` (typeid `ntrs`), `notification_reminder_stage_channels` (typeid `ntsc`), `notification_settings` (typeid `nset`). New columns on `notification_reminder_rules`: `priority`, `suppression_group`. New API surface: stage CRUD, stage channel CRUD, `/notification-settings`, and a read-only `/reminders/preview` that returns what _would_ fire on a given date with reasoning attached.

  The dispatcher now respects:

  - Quiet hours / blackout dates / weekend skips (per `notification_settings`, opt-out per stage via `respectQuietHours`).
  - Cross-rule dedup via `suppression_group` and a per-recipient daily channel rate limit.
  - Multi-channel stages (one decision → one delivery per channel, dedupe key includes channel).

  Engine PR is the first of three milestones; UI hooks (`@voyantjs/notifications-react`) and a new `@voyantjs/notifications-ui` package follow.

### Patch Changes

- 4a6523e: Reminder rule dialog: make the default template optional (#488).

  Stage channels carry their own templates and override the rule-level default,
  so the legacy rule-creation dialog no longer needs to require a template at
  form-submit time. Without this, clicking **Create Rule** with no template
  selected silently failed Zod validation and the dialog appeared frozen.

  Backend `insertNotificationReminderRuleSchema` and
  `updateNotificationReminderRuleSchema` drop the `templateId || templateSlug`
  refinement to match.

  Also narrows the dispatcher's per-target booking lookup from a full-row
  `select()` to the columns actually used by recipient resolution. This avoids
  projecting every column declared in the bookings schema and tolerates
  deployments / test stubs that lag the latest column set.

- 4a6523e: Push a date envelope into the dispatcher's open-target SQL (#488).

  Closes the perf caveat noted on PR #494: previously
  `fetchOpenPaymentScheduleTargets` / `fetchOpenInvoiceTargets` returned
  every open row and the in-app stage walk filtered them by
  anchor + window. With the partial indexes from `0002` that's already
  fast on most deployments, but for tens of thousands of open rows × N
  active rules the per-sweep memory footprint grows.

  `computeAnchorDateEnvelope(stages, today, anchor)` inverts the
  `inWindow` math (`anchor + start ≤ today ≤ anchor + end` →
  `today − end ≤ anchor ≤ today − start`) and unions the ranges across
  all stages that share the requested anchor. The fetchers now accept
  a `DateEnvelopes` map and add a `BETWEEN` clause to the WHERE so
  Postgres only returns targets whose anchor date could plausibly fire
  today.

  Pushdown is enabled per-anchor when at least one of the rule's stages
  anchors on it: `due_date` for both target types, `invoice_issued_at`
  for invoices. Stages anchored on `departure_date`, `booking_created_at`,
  or `last_send_at` fall through to the unfiltered fetch — those are
  expected to be rare and the in-app window check still rejects misses.

  Adds 4 unit tests for `computeAnchorDateEnvelope` (null, single
  stage, union across stages, mixed-anchor isolation). Integration
  suite stays 3/3.

  Also makes `templates/operator/scripts/migrate.ts` log applied
  migrations and prints a clear "restart any long-lived workers" line
  afterwards — drizzle's prepared-statement cache is keyed to the old
  schema and any worker that started before the migration will fail on
  the first query touching a changed column.

- 4a6523e: Honor the stage channel's template at delivery time (#488).

  Bug: when the operator's hourly cron sweep
  (`notifications.send-due-reminders`) queued a stage's per-channel run
  and the `notifications.deliver-reminder` workflow picked it up,
  `deliverReminderRun` was passing `rule.templateId` /
  `rule.templateSlug` / `rule.channel` / `rule.provider` to the
  sender — i.e. the rule-level fallback. The stage channel's own
  template (the one operators picked in the channel editor) was never
  consulted, so reminders went out with the wrong template (or
  silently failed if the rule had no fallback template).

  Fix: introduce `resolveChannelOverride(db, run, rule)` that reads
  `run.metadata.stageChannelId` (which the dispatcher writes when it
  queues the run) and looks up the stage channel. The queued sender
  helpers now use the override's `channel` / `templateId` /
  `templateSlug` / `provider` and only fall back to rule-level values
  when the stage channel can't be resolved.

  Also narrows several `db.select().from(bookings|invoices|...)` calls
  that were projecting every drizzle-declared column. The narrower
  projections only ask for the fields the dispatcher actually reads,
  so deployments / test stubs that lag the latest column set don't
  break delivery.

  Adds an end-to-end integration test
  (`reminder-sequences.test.ts > "queues per-channel and uses the
stage channel's template at delivery time"`) that creates two
  templates, gives the rule the wrong default and the stage channel
  the correct one, queues, delivers, and asserts the recipient got
  the stage channel's subject and body.

- Updated dependencies [3af39d1]
- Updated dependencies [3420711]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/bookings@0.29.0
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/finance@0.29.0
  - @voyantjs/hono@0.29.0
  - @voyantjs/legal@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
  - @voyantjs/bookings@0.28.3
  - @voyantjs/core@0.28.3
  - @voyantjs/db@0.28.3
  - @voyantjs/finance@0.28.3
  - @voyantjs/hono@0.28.3
  - @voyantjs/legal@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/bookings@0.28.2
- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/finance@0.28.2
- @voyantjs/hono@0.28.2
- @voyantjs/legal@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/bookings@0.28.1
- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/finance@0.28.1
- @voyantjs/hono@0.28.1
- @voyantjs/legal@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/bookings@0.28.0
- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/finance@0.28.0
- @voyantjs/hono@0.28.0
- @voyantjs/legal@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/bookings@0.27.0
- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/finance@0.27.0
- @voyantjs/hono@0.27.0
- @voyantjs/legal@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/bookings@0.26.9
- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/finance@0.26.9
- @voyantjs/hono@0.26.9
- @voyantjs/legal@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/bookings@0.26.8
- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/finance@0.26.8
- @voyantjs/hono@0.26.8
- @voyantjs/legal@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/bookings@0.26.7
- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/finance@0.26.7
- @voyantjs/hono@0.26.7
- @voyantjs/legal@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/core@0.26.6
  - @voyantjs/db@0.26.6
  - @voyantjs/finance@0.26.6
  - @voyantjs/hono@0.26.6
  - @voyantjs/legal@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/bookings@0.26.5
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/finance@0.26.5
  - @voyantjs/hono@0.26.5
  - @voyantjs/legal@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/bookings@0.26.4
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/finance@0.26.4
  - @voyantjs/hono@0.26.4
  - @voyantjs/legal@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/bookings@0.26.3
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/finance@0.26.3
  - @voyantjs/hono@0.26.3
  - @voyantjs/legal@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/bookings@0.26.2
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/finance@0.26.2
  - @voyantjs/hono@0.26.2
  - @voyantjs/legal@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/finance@0.26.1
  - @voyantjs/hono@0.26.1
  - @voyantjs/legal@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/finance@0.26.0
- @voyantjs/hono@0.26.0
- @voyantjs/legal@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/finance@0.25.0
- @voyantjs/hono@0.25.0
- @voyantjs/legal@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/finance@0.24.3
- @voyantjs/hono@0.24.3
- @voyantjs/legal@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/bookings@0.24.2
- @voyantjs/core@0.24.2
- @voyantjs/db@0.24.2
- @voyantjs/finance@0.24.2
- @voyantjs/hono@0.24.2
- @voyantjs/legal@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/bookings@0.24.1
- @voyantjs/core@0.24.1
- @voyantjs/db@0.24.1
- @voyantjs/finance@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/legal@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/finance@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/legal@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/finance@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/legal@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/finance@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/legal@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/finance@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/legal@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/finance@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/legal@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [cc3eddd]
  - @voyantjs/bookings@0.20.0
  - @voyantjs/core@0.20.0
  - @voyantjs/db@0.20.0
  - @voyantjs/finance@0.20.0
  - @voyantjs/hono@0.20.0
  - @voyantjs/legal@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/bookings@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/finance@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/legal@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/finance@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/legal@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Retired `@voyantjs/voyant-cloud`. SDK v0.6.0 ships the env-bindings helpers natively (`getVoyantCloudClient` / `tryGetVoyantCloudClient` / `VoyantCloudConfigError` / `VoyantCloudEnv`) — consumers import directly from `@voyantjs/cloud-sdk`. `@voyantjs/notifications` cloud providers now type-import `VoyantCloudClient` from `@voyantjs/cloud-sdk`.
- 66d722d: `resolveDb` callbacks in `createNotificationsHonoModule` and `createLegalHonoModule` now return `AnyDrizzleDb` (the `PostgresJsDatabase | NeonHttpDatabase` union from `@voyantjs/db`) instead of strictly `PostgresJsDatabase`. Templates wiring `getDbFromHyperdrive` no longer need the `as unknown as PostgresJsDatabase` apology cast.

  New shared type alias `AnyDrizzleDb` exported from `@voyantjs/db`. Also normalized three `bindings: unknown` parameter types to `bindings: Record<string, unknown>` in `packages/legal/src/contracts/routes.ts` (`resolveDocumentGenerator`, `resolveDocumentDownloadUrl`, `resolveEventBus`) — was previously inconsistent with the rest of the workspace.

### Patch Changes

- 66d722d: Removed the unused `@voyantjs/vault` and `@voyantjs/verify` wrapper packages. They were thin abstractions over `@voyantjs/cloud-sdk` calls (`vault.getSecret`, `verify.start`/`check`) with zero source-code importers anywhere. Templates that need vault or verify primitives now call the SDK directly via `getVoyantCloudClient(env).vault.getSecret(...)` etc.
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/finance@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/legal@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [a4bc773]
  - @voyantjs/bookings@0.16.0
  - @voyantjs/core@0.16.0
  - @voyantjs/db@0.16.0
  - @voyantjs/finance@0.16.0
  - @voyantjs/hono@0.16.0
  - @voyantjs/legal@0.16.0
  - @voyantjs/voyant-cloud@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/finance@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/legal@0.15.0
- @voyantjs/voyant-cloud@0.15.0

## 0.14.0

### Minor Changes

- 93fd1a5: Voyant Cloud is now the default email/SMS/verify/vault provider for templates. Resend/Twilio adapters and auto-provider-resolution have been removed from `@voyantjs/notifications`; templates wire `@voyantjs/voyant-cloud` directly.

  **New packages:**

  - `@voyantjs/voyant-cloud` — `getVoyantCloudClient(env)` (throws when `VOYANT_CLOUD_API_KEY` is missing) and `tryGetVoyantCloudClient(env)` (returns `null`). Wraps `@voyantjs/cloud-sdk`.
  - `@voyantjs/verify` — `VerifyProvider` interface (`start` / `check`) plus `createVoyantCloudVerifyProvider({ client })` and `createLocalVerifyProvider()` for dev. `createVerifyService(provider)` is a thin wrapper.
  - `@voyantjs/vault` — `VaultProvider` interface (`getSecret(slug, key)`) plus `createVoyantCloudVaultProvider({ client })` and `createEnvVaultProvider({ env, resolveEnvKey? })` for self-hosters. `createVaultService(provider)` adds `(slug,key)` caching and `requireSecret`.

  **Breaking changes — `@voyantjs/notifications`:**

  - Removed `createResendProvider`, `createTwilioProvider`, `createDefaultNotificationProviders`, `createResendProviderFromEnv`, `createTwilioProviderFromEnv`. Removed sub-paths `./providers/resend`, `./providers/twilio`, `./provider-resolution`. The `local` provider stays for dev.
  - Added `createVoyantCloudEmailProvider({ client, from, replyTo? })` and `createVoyantCloudSmsProvider({ client, from? })` (sub-paths `./providers/voyant-cloud-email`, `./providers/voyant-cloud-sms`).
  - `buildNotificationTaskRuntime(env, options)` now throws when neither `providers` nor `resolveProviders` is supplied — there are no built-in defaults.

  **Breaking change — `@voyantjs/plugin-netopia`:**

  - `buildNetopiaNotificationRuntime` now throws `NetopiaNotificationRuntimeError` when neither `resolveNotificationProviders` nor `notificationProviders` is supplied. Templates must inject providers explicitly.

  **Migration for self-hosters who want raw Resend/Twilio:** implement `NotificationProvider` against your transport of choice and register it in your template's `src/lib/notifications.ts`. The interface is unchanged and remains the public extension point.

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/bookings@0.14.0
  - @voyantjs/core@0.14.0
  - @voyantjs/db@0.14.0
  - @voyantjs/finance@0.14.0
  - @voyantjs/hono@0.14.0
  - @voyantjs/legal@0.14.0
  - @voyantjs/voyant-cloud@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/finance@0.13.0
  - @voyantjs/hono@0.13.0
  - @voyantjs/legal@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/finance@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/legal@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/db@0.11.0
  - @voyantjs/finance@0.11.0
  - @voyantjs/hono@0.11.0
  - @voyantjs/legal@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
- Updated dependencies [29a581a]
  - @voyantjs/bookings@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/legal@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/legal@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/bookings@0.8.0
  - @voyantjs/core@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/finance@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/legal@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/db@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/legal@0.7.0

## 0.6.9

### Patch Changes

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/finance@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/legal@0.6.9

## 0.6.8

### Patch Changes

- b218885: Add composite list indexes for notification admin queries.
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/legal@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/legal@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/legal@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/finance@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/legal@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/legal@0.6.4

## 0.6.3

### Patch Changes

- 93d3734: Make worker-driven due reminder processing durable by queueing reminder runs before provider delivery and delivering each run in its own retryable background task.
- d3c6937: Add a narrow execution lock surface and use it to serialize worker-driven notification reminder sweeps across processes.
- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/legal@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/legal@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/legal@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/legal@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/finance@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/legal@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/legal@0.4.5

## 0.4.4

### Patch Changes

- 9349604: Enrich notification reminder run reads with linked rule, delivery, and entity
  context, and add direct reminder-run lookup for admin workflows.
  - @voyantjs/bookings@0.4.4
  - @voyantjs/core@0.4.4
  - @voyantjs/db@0.4.4
  - @voyantjs/finance@0.4.4
  - @voyantjs/hono@0.4.4
  - @voyantjs/legal@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/finance@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/legal@0.4.3

## 0.4.2

### Patch Changes

- 8de4602: Add optional event-bus hooks around document primitives.

  - `@voyantjs/legal` contract document generation routes/services can now emit
    `contract.document.generated`
  - `@voyantjs/finance` invoice document generation can emit
    `invoice.document.generated`, and settlement reconciliation can emit
    `invoice.settled`
  - `@voyantjs/notifications` booking document sends can emit
    `booking.documents.sent`

  These stay at the primitive layer so apps can orchestrate their own document
  policies without Voyant owning the full workflow.

- Updated dependencies [8de4602]
  - @voyantjs/bookings@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/db@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/legal@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
- Updated dependencies [a49630a]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/finance@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/legal@0.4.1

## 0.4.0

### Minor Changes

- e84fe0f: Add first-class booking document bundle and send workflows. Notifications can
  now list booking-scoped contract/invoice/proforma artifacts, send email
  attachments, and deliver those attachments through Resend using artifact
  download URLs or custom attachment resolvers.
- e84fe0f: Add invoice-targeted reminder rules and runs so unpaid invoice/proforma
  documents created for bank-transfer checkout flows can use the same first-class
  reminder engine and checkout reminder visibility as schedule-backed reminders.

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/legal@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add a first-class public storefront verification flow with email and SMS
  challenge start/confirm routes, pluggable developer-supplied senders, and
  built-in notification-provider adapters including Resend email and Twilio SMS.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/finance@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/bookings@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/finance@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/bookings@0.2.0
- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/finance@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/bookings@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/finance@0.1.1
- @voyantjs/hono@0.1.1
