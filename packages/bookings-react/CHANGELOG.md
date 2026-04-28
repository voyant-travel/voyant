# @voyantjs/bookings-react

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/react@0.12.0

## 0.11.0

### Minor Changes

- fe905b0: **BREAKING:** privatize the Booking state machine; add Start, Complete, and Override verbs.

  The transition graph (`BOOKING_TRANSITIONS`, `canTransitionBooking`, `transitionBooking`, `BookingStatusPatch`, `BookingTransitionError`) is no longer part of the `@voyantjs/bookings` public surface. The lifecycle laws live behind the service-verb seam — callers cross it via named verbs in the ubiquitous language. `BookingStatus` stays exported (it's data).

  **HTTP — verb routes replace the generic status PATCH:**

  - `PATCH /:id/status` is **removed**.
  - `POST /:id/start` — confirmed → in_progress (new). Emits `booking.started`.
  - `POST /:id/complete` — in_progress → completed (new). Emits `booking.completed`. Cascades confirmed allocations + items to `fulfilled`.
  - `POST /:id/override-status` — admin override that bypasses the transition graph (new). Updates the Booking row only; does **not** cascade. Requires a non-empty `reason`. Emits `booking.status_overridden` as a privileged audit signal distinct from the normal lifecycle events.

  `POST /:id/confirm`, `/:id/cancel`, `/:id/expire`, `/:id/extend-hold` are unchanged.

  **Service:**

  - `bookingsService.updateBookingStatus(...)` is **removed**.
  - `bookingsService.startBooking(...)`, `.completeBooking(...)`, `.overrideBookingStatus(...)` are added.
  - `updateBookingStatusSchema` is removed; `startBookingSchema`, `completeBookingSchema`, `overrideBookingStatusSchema` are added.
  - Activity-type enum gains `booking_started`, `booking_completed`, `status_overridden`. Run `drizzle-kit push` to sync.

  **React (`@voyantjs/bookings-react`):**

  `useBookingStatusMutation` / `useBookingStatusByIdMutation` now require `currentStatus` in their input. The hook dispatches client-side to the right verb endpoint; non-adjacent jumps fall through to `/override-status`, using the operator's note as the reason. The `<StatusChangeDialog>` UX is unchanged — pass the booking's current status from props.

  **Domain language:** `Start`, `Complete`, and `Override` are added to UBIQUITOUS_LANGUAGE.md as Booking-scoped lifecycle verbs.

  **Migration:**

  - Remove imports of `BOOKING_TRANSITIONS` / `canTransitionBooking` / `transitionBooking` / `BookingTransitionError` / `BookingStatusPatch` from `@voyantjs/bookings` — call the service verbs instead. Internal callers (within this monorepo) had none.
  - Replace `PATCH /v1/bookings/:id/status` calls with the matching verb endpoint, or `/override-status` with a `reason`.
  - Update calls to the React status hooks to pass `currentStatus`.

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/react@0.11.0

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
  - @voyantjs/bookings@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Minor Changes

- 3a6a4db: **Rename**: `QuickBookDialog` → `BookingCreateDialog` across the registry, operator, and dmc templates. The dialog was originally a lightweight create alternative to a flat-form CTA, but since the composition slice landed (#264 — product / departure / rooms / person / shared-room / passengers / price breakdown / voucher / payment schedule all wired through the atomic `/quick-create` endpoint) it IS the booking-create workflow. Keeping "Quick Book" in the name actively misled operators.

  **Bumped via this changeset but not code-changed on npm**: this package is on the fixed release train with everything else, so it ships the version bump alongside the others. The actual rename lives in `@voyantjs/voyant-ui` (registry, in the ignore list), `@voyantjs/i18n` (private), and the templates — consumers see the effect via fresh starter archives (`voyant new`) or the next `shadcn add`.

  Breaking for consumers who copied the registry component earlier:

  - `QuickBookDialog` → `BookingCreateDialog` (symbol)
  - `quick-book-dialog.tsx` → `booking-create-dialog.tsx` (file path)
  - Registry entry `voyant-bookings-quick-book-dialog` → `voyant-bookings-booking-create-dialog`
  - i18n namespace `bookings.quickBook` → `bookings.create`; `bookings.list.quickBook` removed (booking list now has a single "+ New Booking" CTA)
  - `BookingDialog` now declares `voyant-bookings-booking-create-dialog` as a registry dep, so `shadcn add voyant-bookings-booking-dialog` pulls both in automatically

  Consumers who migrated the files locally can drop the old `QuickBookDialog` copy and regenerate via the registry, or run the equivalent of `grep -rl 'QuickBookDialog\|quick-book-dialog\|bookings\\.quickBook' | xargs sed -i ''` on their app.

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/bookings@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Minor Changes

- 96612b3: Bookings-create composition surface (#223) and vouchers-as-first-class (#227) — the packages on the release train all move together, so this covers the batch.

  **Atomic booking create (#263, #264, #265, #266)**

  - `POST /v1/admin/bookings/quick-create` — one-shot endpoint that converts a product, inserts travelers + payment schedules, redeems a voucher, and creates/joins a `booking_group` inside a single DB transaction. `quickCreateBooking(db, input, { userId, runtime })` service in `@voyantjs/finance`; `useBookingQuickCreateMutation` in `@voyantjs/bookings-react`.
  - `POST /v1/admin/bookings/dual-create` — partaj flow: two bookings + one shared-room group, also atomic. `dualCreateBooking` service, `useBookingDualCreateMutation` hook.
  - `booking.quick-created` and `booking.dual-created` events emitted post-commit when a runtime eventBus is wired.
  - `QuickBookDialog` now mounts all nine picker sections (product, departure, rooms, person, shared-room, passengers, price breakdown, voucher, payment schedule) and submits via quick-create. Post-create "Confirm & notify traveler" toggle uses the new `useBookingStatusByIdMutation` to transition the fresh booking to `confirmed` — which (when `autoConfirmAndDispatch` is on) fires the doc bundle + traveler email through the existing `booking.confirmed` subscriber.
  - Bookings fix: `productDaysRef` / `getConvertProductData` now join through `product_itineraries` to match the real products schema; the existing `POST /v1/bookings/from-product` convert path works again.

  **Vouchers as first-class financial instruments (#262, #267)**

  - One-shot data migration: `migrateVouchersFromPaymentInstruments(db, opts)` in `@voyantjs/finance` (CLI wrapper `pnpm -F @voyantjs/finance migrate:vouchers`, `--dry-run` supported). Idempotent; pulls code, currency, amount, expiry from legacy JSONB metadata into the new `vouchers` table.
  - `vouchers.validFrom` (start-of-validity, maps to OpenTravel `Finance.Voucher.effectiveDate`) and `vouchers.seriesCode` (batch/campaign id, maps to `Finance.Voucher.seriesCode`) columns added. Redeem guard returns `voucher_not_started` when now < validFrom; the public `validateVoucher` `not_started` branch is now reachable. `seriesCode` exposed as a list filter. Migration pulls both from legacy metadata (honouring OpenTravel's `effectiveDate` alias).

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- 7619ef0: Continue the traveler-first booking contract cleanup across the published booking surfaces while preserving compatibility aliases.

  - `@voyantjs/bookings`: add traveler-first public aliases for booking travel details, group traveler routes, public booking-session traveler input, and traveler-facing validation/error wording while keeping legacy participant/passenger compatibility routes and schemas.
  - `@voyantjs/bookings-react`: make traveler hooks, query options, schemas, and exports the primary surface again; keep passenger/item-participant names as compatibility aliases instead of separate primaries.
  - `@voyantjs/customer-portal` and `@voyantjs/customer-portal-react`: move booking import schemas, operations, and exports to traveler-first names while preserving legacy participant aliases and routes.
  - `@voyantjs/transactions`: expose traveler-first request/response aliases and traveler route aliases for offer/order traveler and item-traveler flows while preserving legacy participant compatibility endpoints.
  - `@voyantjs/auth-react`: add exported query keys, query options, and schemas for current workspace, organization members, and organization invitations so app surfaces can consume the auth workspace contract directly.
  - `@voyantjs/products` and `@voyantjs/products-react`: tighten the itinerary-facing public surface and query/schema exports used by the shared product itinerary UI.
  - `@voyantjs/legal` and `@voyantjs/notifications`: keep template authoring and Liquid exports available from the package roots while aligning the notification/template surface with the updated booking traveler contract.
  - Supporting packages and tests also picked up repo-wide import-order, lint, and small compatibility cleanups across auth, booking requirements, checkout, octo, pricing, sellability, storefront, and utilities as part of bringing the whole worktree back to a green release state.
  - Align the touched app/template compatibility wrappers with the new primary traveler and workspace surfaces, and keep repo `typecheck` / `lint` green after the broader cleanup.

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/bookings@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Minor Changes

- b7d56c5: Add `useBookingPrimaryProduct(bookingId)` hook and make `BookingCancellationDialog` + `BookingGroupSection` self-resolve `productId` (and `optionUnitId`) from the booking's items.

  The hook returns `{ productId, optionUnitId, isPending, isLoading }`, using the canonical "first item with a non-null productId" rule — the same heuristic every consumer was duplicating. Components auto-resolve by default when the prop is `undefined`; pass an explicit string or `null` as an override for multi-product bookings or to force the non-product-scoped policy.

  This fixes a quiet correctness regression where callers who forgot to wire `productId` silently fell back to the default cancellation policy instead of the product-scoped one.

- 521147e: Add canonical booking status presentation helpers to `@voyantjs/bookings-react`:

  - `bookingStatusBadgeVariant: Record<BookingStatus, 'default' | 'secondary' | 'outline' | 'destructive'>` — exhaustive (not `Record<string, …>`), so adding a new booking status becomes a compile error here instead of a silent UX miss in every app.
  - `formatBookingStatus(status)` — humanized label (`"in_progress"` → `"In Progress"`).
  - `bookingStatuses` / `bookingStatusOptions` — status list derived from the Zod schema, ready for Select pickers.
  - `BookingStatus` type (now exported from `./schemas`).

  Registry components in `@voyantjs/voyant-ui` (`booking-list`, `booking-detail-page` copies, `status-change-dialog`) drop their duplicated local `statusVariant` / `formatStatus` / `BOOKING_STATUSES` constants and consume these instead — single source of truth.

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers` / `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

- ce72e29: Add a shared-room / split-booking group model

  Multiple separate bookings can now intentionally share one room/accommodation while each booking keeps its own finance + traveler records. Inspired by the ProTravel v3 `sharing_groups` pattern: flat peer bookings, a lightweight `booking_groups` + `booking_group_members` schema, smart cleanup on cancellation.

  `@voyantjs/bookings`: new `bookingGroups` and `bookingGroupMembers` tables (TypeID prefixes `bkgr` / `bkgm`), service functions for CRUD plus reverse lookup, unified traveler list across members, and automatic group dissolution when a cancellation leaves ≤1 active members. New routes under `/v1/bookings/groups` plus the REST-nested `GET /v1/bookings/:id/group`.

  `@voyantjs/bookings-react`: hooks for `useBookingGroups`, `useBookingGroup`, `useBookingGroupForBooking`, `useBookingGroupMutation`, and `useBookingGroupMemberMutation` (stateless — accepts `groupId` per-call so create-then-add flows work with a single hook instance).

  `@voyantjs/db`: register TypeID prefixes `bkgr` (booking_groups) and `bkgm` (booking_group_members).

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/bookings@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/bookings@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/bookings@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add first-class public booking-session wizard state and storefront repricing.

  `@voyantjs/bookings` now persists wizard session state in `booking_session_states`,
  includes that state in public session reads, exposes public state read/write
  routes, and adds `POST /v1/public/bookings/sessions/:sessionId/reprice` for
  previewing or applying room/unit repricing back onto the booking session.

  `@voyantjs/bookings-react` now exports public session/state query helpers and a
  mutation helper for session state updates and repricing.

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- 90bcdb1: Add reusable query-option builders for bookings data so TanStack route loaders can prefetch bookings pages against the shared React Query cache.
- e57725d: Flatten frontend provider wiring around a shared `@voyantjs/react` config provider so module react packages can share one app-level Voyant context.
- Updated dependencies [e57725d]
  - @voyantjs/bookings@0.3.0
  - @voyantjs/react@0.3.0
