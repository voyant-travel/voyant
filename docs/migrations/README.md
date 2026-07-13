# Migrations

Per-minor consolidated migration notes for Voyant. Each page collects every breaking change in a release train into one read — removed exports across all packages, schema column changes, HTTP route changes, hook signature changes, activity-log enum changes, and the caller-code rewrites needed to land on the new minor.

The full history (including patch-level changes and dependency updates) lives in the per-package `CHANGELOG.md` files; these pages exist because changeset entries land in *every* package's CHANGELOG that depends on the changed one, so the actual breaking signal is otherwise buried under dozens of `Updated dependencies [...]` lines per package.

## Available

- [Migrating Framework to 0.42](./migrating-to-0.42.md) - require explicit selected IDs and admitted API runtime reference IDs in hand-authored graph runtime inputs.
- [Migrating to 0.11](./migrating-to-0.11.md) — privatize Booking state machine; replace `PATCH /:id/status` with named verbs; `useBookingStatusMutation` requires `currentStatus`; activity-type enum gains three values.
- [Migrating to 0.10](./migrating-to-0.10.md) — encrypt `accessibility_needs` at rest; explicit Booking state machine + `transitionBooking` guards; drop `redeemed` status; add `bookings.fx_rate_set_id`; `requireActor` fail-closed; `Idempotency-Key` middleware on booking-creation endpoints; mandatory PII redaction + audit on admin booking reads.

## Long-jumping

If you skipped releases (e.g. `0.9 → 0.11`), apply the pages in order — each one assumes the previous minor is in place. Schema migrations stack: run `drizzle-kit push` once at the end is fine, but service-call rewrites in 0.11 (e.g. dropping `transitionBooking` imports) only make sense if you've already applied 0.10's migration of `db.update(bookings).set({ status })` patterns to the state machine.

## Authoring (for maintainers)

When cutting a minor with breaking changes, add a `migrating-to-0.X.md` page **alongside** the changeset, not after the release. Each breaking changeset should also link the consolidated page in its own description so consumers landing on the per-package CHANGELOG can find it.

The page should cover, in this order:

1. **TL;DR** — the 5-bullet executive summary.
2. **Schema changes** — added / dropped columns, new enum values, CHECK constraints; with `drizzle-kit push` notes.
3. **Removed exports** — old symbol → new symbol, including renames that are *not* backward-aliased.
4. **HTTP route changes** — removed routes, replacement verbs.
5. **Hook signature changes** — old signature → new signature.
6. **Caller-code migrations** — `before` / `after` rewrites for the most common upgrade paths.
7. **New capabilities** (optional, non-breaking) — worth flagging because consumers may want to opt in during the upgrade.
8. **Per-package CHANGELOG links** — the bottom-of-page exit ramp into the full detail.
