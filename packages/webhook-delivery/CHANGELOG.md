# @voyant-travel/webhook-delivery

## 0.3.1

### Patch Changes

- 8d62a7c: Embed TypeScript sources in published JavaScript source maps so consumer dev servers can resolve
  them without the omitted `src` tree. Stop emitting declaration maps that cannot embed their sources,
  and reject publish tarballs whose maps reference sources that are neither packed nor embedded.
- Updated dependencies [8d62a7c]
  - @voyant-travel/core@0.122.1
  - @voyant-travel/db@0.114.4

## 0.3.0

### Minor Changes

- 2cc954a: Make outbound webhook enqueue authority an explicit deployment provider. Standard Operator and managed-cloud deployments select `outboundWebhooks: "postgres"`; projects may instead select `"host"` with an injected `host.deliverEvent`, or `"none"` to omit graph outbound composition. `@voyant-travel/webhook-delivery` now owns provider resolution and the Postgres enqueuer adapter, while generic Runtime no longer calls the concrete Postgres enqueue function. Regenerate graphs so the provider role is present. See [Migrating to Framework 0.42](../docs/migrations/migrating-to-0.42.md#outbound-webhook-enqueue-provider).

### Patch Changes

- Updated dependencies [cc85042]
- Updated dependencies [07a6ee3]
  - @voyant-travel/core@0.122.0
  - @voyant-travel/db@0.114.2

## 0.2.2

### Patch Changes

- Updated dependencies [3f6694b]
  - @voyant-travel/core@0.121.0
  - @voyant-travel/db@0.114.1

## 0.2.1

### Patch Changes

- Updated dependencies [4d0eeed]
- Updated dependencies [bef5b7c]
  - @voyant-travel/db@0.114.0
  - @voyant-travel/core@0.120.0

## 0.2.0

### Minor Changes

- 490d132: Add the generic Node outbound webhook delivery engine with Postgres persistence, visibility policy admission, HMAC signing, idempotent attempts, bounded retries, terminal dead-letter state, and auditable outcomes.
- 490d132: Provide validated subscription mutations, durable projected webhook enqueue, restart-safe payload storage, and one claim-driven signed, retrying, audited delivery worker.

### Patch Changes

- c65b05c: Move the complete graph-native Node application host into runtime,
  including generated graph admission, local and managed auth, API/admin serving,
  workflow services and schedules, outbound delivery, links, and runtime ports.
  Move the generic Postgres webhook enqueue boundary out of Distribution and into
  the neutral webhook-delivery package.
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
  - @voyant-travel/db@0.113.0
  - @voyant-travel/core@0.119.0
