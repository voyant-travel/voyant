# @voyantjs/cruises

Opt-in cruises module for OTA, tour-operator, and DMC deployments. Provides the
canonical schema, services, and admin/storefront/booking integration for cruise
inventory - both self-managed (a tour operator or DMC publishes its own
small-scale or specialized cruises) and external (sourced from a registered
adapter such as Voyant Connect).

Cruises are an inventory and operations capability inside the target scenarios,
not a separate cruise-line implementation scenario.

See [docs/architecture/cruises-module.md](../../docs/architecture/cruises-module.md) for the full design.

## Status

Early development. Phase 1 (canonical schema + core service for self-managed cruises) is in progress.

## Domain Events

`@voyantjs/cruises` exports stable cruise lifecycle event constants for catalog
and search subscribers:

- `CRUISE_CREATED_EVENT` = `cruise.created`
- `CRUISE_UPDATED_EVENT` = `cruise.updated`
- `CRUISE_DELETED_EVENT` = `cruise.deleted`

Each event carries `{ id }`, where `id` is the local cruise id. Treat the
payload as an invalidation trigger and re-read current cruise state before
updating downstream indexes.
