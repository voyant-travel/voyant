# @voyant-travel/apps

## 0.2.0

### Minor Changes

- 04b031d: Deliver installed app webhook subscriptions through the durable webhook delivery plane with app envelopes, signing key rotation support, lifecycle-aware health, and replay helpers.
- 0868f18: Add the app registry foundation with closed manifest validation, deterministic release compilation, protected manifest ingestion, and admin API wiring.
- 027ca08: Add the app installation aggregate, lifecycle service, reconciliation tables, and TypeID prefixes for app installation records.

### Patch Changes

- Updated dependencies [04b031d]
- Updated dependencies [0868f18]
  - @voyant-travel/webhook-delivery@0.4.0
  - @voyant-travel/admin@0.126.2
