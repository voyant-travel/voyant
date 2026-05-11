# @voyantjs/db

## 0.32.1

### Patch Changes

- @voyantjs/core@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/core@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/core@0.31.4

## 0.31.3

### Patch Changes

- 5f974dd: Add first-class invoice attachment persistence, admin routes, React hooks, and invoice detail UI.
  - @voyantjs/core@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/core@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/core@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/core@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/core@0.30.7

## 0.30.6

### Patch Changes

- 5a4c592: Expose concrete schema file subpaths in the published `@voyantjs/db` export map so Vite/Rollup can resolve deep imports such as `@voyantjs/db/schema/iam/kms`.
  - @voyantjs/core@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/core@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/core@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/core@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/core@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/core@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/core@0.30.0

## 0.29.0

### Minor Changes

- db51715: Closes #500: switch both templates' Workers DB layer from Hyperdrive to the Neon serverless WebSocket driver. Drops the \`HYPERDRIVE\` binding from \`wrangler.jsonc\` + \`env.d.ts\` in both \`templates/dmc\` and \`templates/operator\`; templates now connect directly via \`@neondatabase/serverless\` Pool + \`drizzle-orm/neon-serverless\` using the same \`DATABASE_URL\` secret.

  Two helpers ship in each template's \`src/api/lib/db.ts\`:

  - \`getDbFromEnv(env, executionCtx?)\` — returns a per-request \`NeonDatabase\`. When \`executionCtx\` is passed, schedules \`pool.end()\` via \`waitUntil\` so the WebSocket closes promptly. When omitted, the Pool is left for the Workers runtime to reclaim on isolate teardown.
  - \`withDbFromEnv(env, fn)\` — higher-order helper for non-Hono code paths (event subscribers, scheduled handlers, retry workers). Owns the Pool lifecycle inline (open → \`fn\` → \`finally pool.end()\`).

  Touched packages get a minor bump because the shared types broaden:

  - \`@voyantjs/db\` — \`AnyDrizzleDb\` union now includes \`NeonDatabase\` from \`drizzle-orm/neon-serverless\` alongside the existing \`PostgresJsDatabase\` and \`NeonHttpDatabase\` flavors.
  - \`@voyantjs/hono\` — \`VoyantDb\` (the type Hono ctx variables expose under \`c.var.db\`) widens the same way.

  Why WebSocket and not HTTP: the bookings package and other internal services use \`db.transaction(...)\` for read-then-write logic that needs real Postgres transaction semantics. Neon's HTTP transport only batches statements (atomic but no isolation); WebSocket gives full transaction support on Workers.

  Subscribers in \`catalog-bridge\`, \`booking-schedule\`, \`smartbill\`, \`catalog-checkout\` were converted to \`withDbFromEnv\` so the Pool is owned by each subscriber call. \`getBetterAuth\` and other helpers that were hard to thread \`executionCtx\` through still call \`getDbFromEnv(env)\` without it — the Pool lingers until isolate teardown there. Tracked as a follow-up audit in #510.

  No schema migration. No behavior change for existing API contracts. Operators upgrading need to: drop the \`HYPERDRIVE\` binding from their \`wrangler.jsonc\` (if they had one), and ensure their \`DATABASE_URL\` points at a Neon Postgres reachable over WebSocket (the standard Neon connection string).

### Patch Changes

- 583326e: PR3 of #497: catalog-plane wiring + boundary scheduler.

  Storefront cards now render badges + strikethrough prices automatically when an active offer applies to a product. Offers fire at `valid_from` / expire at `valid_until` within ~5 minutes of the boundary (every-5-min cron in the operator template).

  This PR adds:

  **`@voyantjs/products`** — new `productPromotionsCatalogPolicy` (in `./catalog-policy-promotions`) declaring 14 annotation fields the products search document picks up: `hasOffer`, `bestOfferId`, `bestOfferName`, `bestOfferDiscountKind`, `bestOfferDiscountPercent`, `bestOfferDiscountAmountCents`, `originalPriceFromAmountCents`, plus the matching `conditionalOffer*` set for "From N pax: extra X% off" hints. Visibility `[staff, customer, partner]`.

  **`@voyantjs/promotions`** —

  - `./service-catalog-plane-promotions` — `createProductPromotionsProjectionExtension()`. Annotation-only contract per §3.7: does NOT touch `priceFromAmountCents`. Storefront consumers compute the effective price client-side. `loadOriginalPrice` callback lets templates wire a richer MIN-across-options resolver for option-driven products; default reads `products.sell_amount_cents`.
  - `./service-boundary-scheduler` — `runPromotionBoundaryScheduler({ db, eventBus? })`. Scans `promotional_offers` for `valid_from` / `valid_until` crossings since the persisted watermark, returns the `BoundaryCrossing[]` so cron handlers without an in-process bus can dispatch the reindex inline (Cloudflare scheduled handlers don't share an `EventBus` with the running app's catalog-bridge). New `promotional_offer_scheduler_state` watermark table (single row, sentinel-keyed for defense). New typeid `pofs`.
  - `createDrizzleOfferDataSource` (PR2) widened from `PostgresJsDatabase` to `AnyDrizzleDb` so the projection extension can use it from the products document builder's call site.

  **`@voyantjs/db`** — new `pofs` typeid prefix for `promotional_offer_scheduler_state`.

  **Operator template** —

  - Schema added to `drizzle.config.ts`; migration `0007_oval_hex.sql` generated.
  - `catalog-runtime.ts` composes `productPromotionsCatalogPolicy` + `createProductPromotionsProjectionExtension()` into the products registry / builder.
  - `catalog-bridge.ts` subscribes to `promotion.changed` — reindexes the affected products on offer mutations + scheduler firings. `affected.kind: "all"` is logged + skipped (bulk-reindex API on `IndexerService` is a future enhancement; in practice global / market / audience scope changes are operator-rare).
  - New `src/api/promotion-scheduled.ts` cron handler (`*/5 * * * *`) — runs the scheduler, then reindexes the unique product set across all crossings via the same indexer code path the live bridge uses.
  - `wrangler.jsonc` adds the cron; `entry.ts` dispatches it.

  10 new unit tests + 9 new integration tests. 76 unit tests pass, 26 integration tests skipped without `TEST_DATABASE_URL`.

  **Known v1 limitations** (per §15 / §14 of the architecture doc):

  - Catalog filter / sort uses `priceFromAmountCents` (list price) rather than effective price — `bestOffer*` annotations don't change which products match a `< $200` filter when a product is on sale. Real fix is the §15.1 ordered-extensions contract change, deferred.
  - `affected.kind: "all"` reindex pathway is a no-op until `IndexerService` grows a bulk-reindex helper.

- 583326e: Initial release of `@voyantjs/promotions` — PR1 of #497.

  Ships the schema + admin CRUD foundation for promotional offers (auto-applied catalog discounts, code-redeemed discounts at checkout, and audience- / market-scoped blanket discounts). Catalog-plane wiring lands in PR3 with the boundary scheduler; booking-engine integration in PR4. Full design in `docs/architecture/promotions-architecture.md`.

  This PR adds:

  - Three tables — `promotional_offers`, `promotional_offer_products` (denormalized scope materialization for `products` / `categories` / `destinations` scopes), `promotional_offer_redemptions` (per-`(offer, booking)` audit row with idempotent unique constraint).
  - TypeID prefixes `pofr` (`promotional_offers`) and `pofx` (`promotional_offer_redemptions`) in `@voyantjs/db`.
  - Discriminated-union scope schema with six variants: `global`, `products`, `categories`, `destinations`, `markets`, `audiences`. No `channels` variant in v1 — see §3.2 of the architecture doc.
  - CRUD service (`listOffers`, `getOfferById`, `createOffer`, `updateOffer`, `archiveOffer`, `deleteOffer`) with optional `OfferMutationRuntime.eventBus` to emit `promotion.changed`. Service-layer pre-check on delete returns a clearer error than the raw FK RESTRICT when redemptions exist.
  - Scope materialization (`recomputeOfferLinks`): write-time expansion of `categories` and `destinations` scopes to product IDs via `@voyantjs/products` link tables; slice-shaped scopes (`global`, `markets`, `audiences`) leave the link table empty.
  - Admin routes mounted at `/v1/admin/promotions/*` (auto-mounted by `createApp` based on `module.name`).
  - 30 unit tests + 17 integration tests.

  Operator template now ships the migration and the route mount.

- 4a6523e: Add reminder sequences: stages, channels, and notification settings (#488).

  Reminder rules can now own an ordered list of **stages**, each with its own anchor (`due_date`, `booking_created_at`, `departure_date`, `invoice_issued_at`, or `last_send_at`), eligibility window (`[startDays, endDays]`), and cadence (`once`, `every_n_days`, or `escalating` with `daysUntilDueGT/LT` buckets). Each stage can fan out to multiple channels, each carrying its own template and recipient kind. This subsumes the legacy single-offset rule (one stage, `cadence: once`, anchor `due_date`) and the counter-based escalation pattern from the issue (one stage with `cadence: escalating(...)` plus sibling stages keyed on cumulative `maxSendsInStage`).

  The dispatcher gains a stage-aware path that runs first; rules without stages fall through to the legacy date-offset path (back-compat). The migration creates one stage + one channel per existing rule mirroring the legacy behavior, so existing fires keep working unchanged.

  New tables: `notification_reminder_rule_stages` (typeid `ntrs`), `notification_reminder_stage_channels` (typeid `ntsc`), `notification_settings` (typeid `nset`). New columns on `notification_reminder_rules`: `priority`, `suppression_group`. New API surface: stage CRUD, stage channel CRUD, `/notification-settings`, and a read-only `/reminders/preview` that returns what _would_ fire on a given date with reasoning attached.

  The dispatcher now respects:

  - Quiet hours / blackout dates / weekend skips (per `notification_settings`, opt-out per stage via `respectQuietHours`).
  - Cross-rule dedup via `suppression_group` and a per-recipient daily channel rate limit.
  - Multi-channel stages (one decision → one delivery per channel, dedupe key includes channel).

  Engine PR is the first of three milestones; UI hooks (`@voyantjs/notifications-react`) and a new `@voyantjs/notifications-ui` package follow.

  - @voyantjs/core@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/core@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/core@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/core@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/core@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/core@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/core@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/core@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/core@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6

## 0.26.5

### Patch Changes

- 7a92aba: Replace the `person_directory_projections` cache table with a Postgres view (closes #446).

  The projection table existed to avoid `LATERAL` joins on every people list read, but no current consumer pushes the projection to a search index — it was pure overhead with a rebuild step on every contact-point change. The new `person_directory` view computes the same `(email, phone, website)` triple per person on demand via `LATERAL` lookups against `identity_contact_points`, leaning on the existing `idx_identity_contact_points_entity_kind_primary_created` index.

  Net effect:

  - `crm.people` list reads now flow through the view; `hydratePeople` returns the same shape it always did.
  - The rebuild path is gone — `syncPersonIdentity` no longer calls `rebuildPersonDirectoryProjection`, and the `rebuildPersonDirectoryProjection(s)` exports are removed.
  - Stale-cache risk is eliminated: edits to `identity_contact_points` flow through immediately on the next read.

  Migration: `templates/operator/migrations/0028_person_directory_view.sql` drops the projection table and creates the view; registered in `meta/_journal.json`.

  Out of scope (deferred): if a future Typesense / search pipeline needs materialized snapshots, it can build a `MATERIALIZED VIEW` or its own table from `person_directory` rather than reusing the deprecated projection.

  - @voyantjs/core@0.26.5

## 0.26.4

### Patch Changes

- 6493f62: Add `customer_signals` table for the pre-pipeline interest surface (closes #444).

  Customer signals are the lighter-than-opportunities, heavier-than-segments space — wishlist entries, "notify when this departure opens", inquiry calls captured by an operator, abandoned-cart recovery, request-offer leads. The new `crm.customer_signals` table records:

  - `kind` — `wishlist | notify | inquiry | request_offer | referral`.
  - `source` — `form | phone | admin | abandoned_cart | website | booking`.
  - `status` — `new | contacted | qualified | converted | lost | expired`, default `new`.
  - `priority` (text, validation-layer enum `low | normal | high | urgent`), `notes`, `tags`, `assignedToUserId`, `followUpAt`, `sourceSubmissionId`, `metadata`.
  - `productId`, `optionUnitId`, `resolvedBookingId` as plain `text()` columns — cross-module references stay loose per the project FK rule.

  API:

  - `crmService.listCustomerSignals(db, { personId?, assignedToUserId?, status?, kind?, productId?, search? })` paginated.
  - `crmService.listSignalsForPerson(db, personId)` chronological convenience.
  - CRUD + `crmService.resolveCustomerSignalToBooking(db, signalId, bookingId)` which marks the signal `converted` and pins the bookingId.
  - Admin routes: `GET/POST /v1/admin/crm/customer-signals`, `GET/PATCH/DELETE /v1/admin/crm/customer-signals/:id`, `POST /v1/admin/crm/customer-signals/:id/resolve`, `GET /v1/admin/crm/people/:id/signals`.
  - React hooks: `useCustomerSignals(filters)`, `useCustomerSignalsForPerson(personId)`, `useCustomerSignal(id)`, `useCustomerSignalMutation()` returning `{ create, update, remove, resolve }`.

  Migration: `templates/operator/migrations/0027_customer_signals.sql`, registered in `meta/_journal.json`.

  Out of scope (deferred): full "create booking from signal" orchestration UI; auto-expiry cron that sweeps stale signals to `expired`. The data layer supports both.

  - @voyantjs/core@0.26.4

## 0.26.3

### Patch Changes

- 372cad5: Add person-to-person relationships table for kinship, emergency contacts, and travel companions (closes #442).

  New `crm.person_relationships` table records directed `fromPerson → toPerson` edges of one of eleven kinds (`spouse`, `partner`, `parent`, `child`, `sibling`, `guardian`, `ward`, `emergency_contact`, `friend`, `travel_companion`, `other`). The optional `inverseKind` lets the service auto-write the symmetric edge in the same transaction (parent↔child, guardian↔ward, etc.) so operator UIs don't have to maintain both sides; the auto-inverse path is idempotent on retry. `(from_person_id, to_person_id, kind)` is uniquely indexed and a CHECK constraint rejects self-edges. Migration: `templates/operator/migrations/0026_person_relationships.sql` (registered in `meta/_journal.json`).

  API surface:

  - `crmService.listPersonRelationships(db, personId, { direction?: "from" | "to" | "both" })` — defaults to `both` so the typical "Jane's family" view returns the union.
  - `crmService.createPersonRelationship(db, fromPersonId, { toPersonId, kind, inverseKind?, autoInverse? })`
  - `crmService.getPersonRelationship` / `updatePersonRelationship` / `deletePersonRelationship`
  - Admin routes: `GET/POST /v1/admin/crm/people/:id/relationships`, `GET/PATCH/DELETE /v1/admin/crm/person-relationships/:id`.
  - React hooks: `usePersonRelationships(personId, { direction, kind })`, `usePersonRelationshipMutation(personId)` returning `{ create, update, remove }`.

  Out of scope (deferred): UI components for the relationship graph; phone-keyed emergency-contact convenience helpers (use `metadata` for now). The data layer is ready for both.

  - @voyantjs/core@0.26.3

## 0.26.2

### Patch Changes

- ffdb485: Make `auth.user.email` nullable and add `phone_number` columns so phone-only signups (Better Auth phone-OTP plugin) no longer need a synthetic `<phone>@phone.protravel.ro` placeholder (closes #441).

  Schema: drops the email-only `UNIQUE` on `auth.user.email`, alters the column to nullable, adds `phone_number` (text, nullable) + `phone_number_verified` (boolean, default false), creates partial unique indexes (`user_email_unique WHERE email IS NOT NULL`, `user_phone_unique WHERE phone_number IS NOT NULL`), and a check constraint `user_email_or_phone CHECK (email IS NOT NULL OR phone_number IS NOT NULL)` so a row must carry at least one identifier. Migration ships `templates/operator/migrations/0025_user_email_nullable_phone.sql`.

  Consumer cleanup:

  - `@voyantjs/auth`'s `CurrentUser` type and `getCurrentUser` / `ensureCurrentUserProfile` now treat email as nullable; phone-only signups fall through provisioning instead of being rejected.
  - `@voyantjs/auth-react`'s `currentUserSchema` and `organizationMemberUserSchema` accept null email; `currentUserSchema` also exposes the new `phoneNumber` field.
  - `@voyantjs/customer-portal`'s profile read/write paths handle null `authUser.email`: `getAccessibleBookingIds` and `hasBookingAccess` skip the email-match branch for phone-only users (linked-person matching still works), and `bootstrap` skips email-keyed candidate lookup. Existing email-based flows are unchanged.

  Out of scope for this PR (deferred):

  - Wiring the Better Auth phone-OTP plugin in `@voyantjs/auth/src/server.ts` (needs SMS provider + signup route work). The schema is now ready for it; the plugin wiring lands in a follow-up.
  - @voyantjs/core@0.26.2

## 0.26.1

### Patch Changes

- c0507a6: Move toxic PII to `crm.people` and add structured `person_documents` (closes #440 and #443).

  `user_profiles` is no longer the home for encrypted PII. The four free-text slots (accessibility / dietary / loyalty / insurance) move to `crm.people` so operator-managed humans without auth accounts can carry them, and identity documents graduate to a structured `person_documents` table with type / expiry / issuing authority / attachment + a partial unique index pinning a single primary doc per type per person.

  Booking travelers now snapshot dietary, accessibility, and the primary passport from the linked person record at create time (snapshot-on-create, explicit input always wins) via a new `POST /v1/admin/bookings/:id/travelers/with-travel-details` route. Templates wire the snapshot via `createBookingsHonoModule({ resolveTravelSnapshot })` delegating to `crmService.loadPersonTravelSnapshot` — bookings stays free of any direct CRM dependency.

  Customer portal exposes plaintext `accessibility/dietary/loyalty/insurance` on `/me` plus full CRUD over `/me/documents`. CRM admin gains server-side encrypt/decrypt endpoints (`travel-snapshot`, `profile-pii`, `*/from-plaintext`) so the operator booking-traveler dialog can pre-fill from profile and push diverging values back without the browser holding KMS material. The dialog itself now ships a "Travel details" section with passport / dietary / accessibility fields, plus "Pre-fill from profile" and "Save to profile" affordances when a CRM person is linked.

  Breaking changes (intentionally landed pre-1.0):

  - `user_profiles.documentsEncrypted/accessibilityEncrypted/dietaryEncrypted/loyaltyEncrypted/insuranceEncrypted` columns are removed. Migration ships `templates/operator/migrations/0024_people_pii_documents.sql`.
  - `customerPortalProfileSchema.documents` (array) replaced with separate `accessibility/dietary/loyalty/insurance` plaintext string fields. Document CRUD lives at `/v1/public/customer-portal/me/documents`.
  - `bookingsHonoModule` and `crmHonoModule` are still exported but the env-driven default factory `createBookingsHonoModule()` / `createCrmHonoModule()` is the new recommended entry point.
  - @voyantjs/core@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/core@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/core@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/core@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/core@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/core@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- @voyantjs/core@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/core@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/core@0.19.0

## 0.18.0

### Minor Changes

- 8932f60: Make schema discovery declarative and unblock downstream `drizzle-kit generate` against published packages.

  **Exports — `default` condition added everywhere (fixes #380)**

  Every `@voyantjs/*` package's `publishConfig.exports` previously declared only `types` and `import`. drizzle-kit (and any CJS-based resolver) walked the `require` branch, hit nothing, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED` on subpaths like `@voyantjs/db/schema`. Each subpath now also declares a `default` condition pointing at the same `.js` file, so downstream consumers can resolve subpaths and run their own `drizzle-kit generate` against the canonical runtime schema.

  **Operator template baseline regenerated (fixes #378, #379)**

  `templates/operator/migrations/0000_striped_jubilee.sql` was missing `bookings.fx_rate_set_id` (causing `GET /v1/admin/bookings` to 500), and `@voyantjs/cruises`'s 14 tables had never made it into any baseline. Added `@voyantjs/cruises` to `templates/operator/drizzle.config.ts` and emitted `0004_steady_molten_man.sql` covering all drift (cruise tables/enums, the missing `fx_rate_set_id`, idempotency keys, vouchers, voucher redemptions, the `accessibility_needs` → encrypted-jsonb move, several check constraints, new enum values). Pruned 7 stale orphan migrations that were on disk but not in `_journal.json`. Schema baseline + runtime now match — `drizzle-kit generate` against a freshly migrated DB returns "No schema changes".

  **One `./schema` per module — sub-paths removed (BREAKING)**

  Each module now exposes exactly one schema entrypoint, `./schema`, that re-exports everything DB-related the module owns. Granular sub-paths are deleted from `exports` and `publishConfig.exports`:

  - `@voyantjs/bookings/schema/travel-details` → fold into `@voyantjs/bookings/schema`
  - `@voyantjs/legal/contracts/schema` and `@voyantjs/legal/policies/schema` → fold into the new `@voyantjs/legal/schema`
  - `@voyantjs/{products,crm,cruises,distribution,transactions,charters}/schema` now also re-export the pgTables declared inside `./booking-extension`. The runtime `./booking-extension` HonoExtension export is unchanged.

  Consumers importing from any of the removed sub-paths must switch to the consolidated `./schema` import.

  **Declarative dependency graph in `package.json`**

  Every module package gained a `voyant: { schema, requiresSchemas: [...] }` block declaring its schema entrypoint and the other modules' schemas it needs at the SQL level (e.g. `hospitality` requires `facilities` and `bookings`; `ground` requires `facilities` and `identity`; `suppliers` requires `facilities`; everyone implicitly requires `db`). The CLI reads this block to compute the dependency closure for a project.

  **`@voyantjs/cli` — `resolveSchemas` helper + `voyant db schemas` command**

  New `@voyantjs/cli/drizzle` entrypoint exporting `resolveSchemas(config, options?)` — walks `voyant.requiresSchemas` transitively from the modules listed in `voyant.config.ts`, dedupes, returns specifier strings (default) or absolute file paths (`style: "file"`). Throws on circular dependencies. New `voyant db schemas` debug command prints the resolved closure.

  ```ts
  // drizzle.config.ts
  import { defineConfig } from "drizzle-kit";
  import { resolveSchemas } from "@voyantjs/cli/drizzle";
  import voyantConfig from "./voyant.config";

  export default defineConfig({
    schema: resolveSchemas(voyantConfig),
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
  });
  ```

  Adding a new module to `voyant.config.ts` now picks up its schema (and transitive schema deps) automatically — no more manual schema lists, no forgotten modules.

  **Migration impact for existing operator deployments**

  Apply `0004_steady_molten_man.sql` (column + new tables, non-destructive aside from the deliberate `accessibility_needs` text → encrypted-jsonb move) and `0005_condemned_nomad.sql` (cruise booking-extension tables — only relevant when the cruises module is mounted).

### Patch Changes

- @voyantjs/core@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: `resolveDb` callbacks in `createNotificationsHonoModule` and `createLegalHonoModule` now return `AnyDrizzleDb` (the `PostgresJsDatabase | NeonHttpDatabase` union from `@voyantjs/db`) instead of strictly `PostgresJsDatabase`. Templates wiring `getDbFromHyperdrive` no longer need the `as unknown as PostgresJsDatabase` apology cast.

  New shared type alias `AnyDrizzleDb` exported from `@voyantjs/db`. Also normalized three `bindings: unknown` parameter types to `bindings: Record<string, unknown>` in `packages/legal/src/contracts/routes.ts` (`resolveDocumentGenerator`, `resolveDocumentDownloadUrl`, `resolveEventBus`) — was previously inconsistent with the rest of the workspace.

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/core@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/core@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/core@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/core@0.13.0

## 0.12.0

### Patch Changes

- 944d244: Adds the charters module — a new opt-in vertical for yacht-charter brands carved out of cruises (operators selling Aman, Four Seasons, Ritz-Carlton, SeaDream, A&K, Orient Express style products), designed natively against Voyant's existing module/extension/link conventions and the broker-mediated yacht-charter data shape (whole-yacht vs per-suite, MYBA contracts, APA, multi-currency native pricing).

  **`@voyantjs/charters`** — full server module:

  - 5 tables: charter_products (one per brand × yacht configuration), charter_voyages (a specific dated trip), charter_yachts (vessel specs + crew), charter_suites (per-voyage suite pricing, all four first-class currencies as explicit columns), charter_schedule_days (flat per-voyage itinerary; no template/override two-tier — charter schedules are negotiable).
  - Two booking modes per voyage: `per_suite` and `whole_yacht`. Voyages opt into either or both; whole-yacht requires a resolvable APA percent and an MYBA contract template ref.
  - Multi-currency native (USD/EUR/GBP/AUD as explicit price columns, not derived). `pricingService.quotePerSuite` and `quoteWholeYacht` use pure BigInt-cent math; no float drift. APA computed as integer basis points.
  - `booking_charter_details` 1:1 extension on bookings: `bookingMode` discriminator, source/sourceProvider/sourceRef provenance, multi-currency snapshot fields, MYBA contract id (soft FK to legal.contracts), and APA reconciliation state (paid / spent / refund / settledAt).
  - `chartersBookingService` with four entry points — local + external × per-suite + whole-yacht. Each commits in a single transaction (atomic booking + travelers + extension snapshot). External flows commit upstream BEFORE local writes so the upstream rejection path is loud.
  - `mybaService.generateContract` is DI-shaped — accepts a `CharterContractsService` so charters takes no hard dep on `@voyantjs/legal`. Idempotent; respects voyage override → product default → injected service default precedence.
  - APA reconciliation: `recordApaPayment` (collected from charterer pre-charter) and `reconcileApa` (records on-board spend + refund balance + optional settle stamp). Routes mounted as a `bookings` extension at `POST /v1/admin/bookings/:bookingId/charter-details/apa/{payment,reconcile}`.
  - **Provenance — local + external in one experience.** Charters can be self-managed (operator owns the rows) or external (sourced through a registered `CharterAdapter`). Admin + public routes use a unified-key parser that accepts both `chrt_*` / `chrv_*` / `chry_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints fan out to all registered adapters via parallel `Promise.allSettled`. External writes return 409.
  - Adapter contract (`@voyantjs/charters/adapters`): `CharterAdapter` interface with `listEntries` / `fetchProduct` / `fetchVoyage` / `fetchVoyageSuites` / `fetchVoyageSchedule` / `fetchYacht` / `listVoyagesForProduct` / `createPerSuiteBooking` / `createWholeYachtBooking`. Process-local registry, TTL+LRU memoize decorator, and `MockCharterAdapter` for tests with seeders + `failEveryNthCall` for error-path coverage.
  - Unlike cruises, charters has NO search index — the operator universe is small (six brands in v1) so adapter fan-out per request is plenty.
  - 77 unit tests covering pricing math (USD/EUR/GBP/AUD currency resolution, fractional APA percentages, BigInt cent precision), MYBA service (idempotency, template precedence, variable propagation), booking-extension validation (mode-specific refinements, external provenance rules), routes (invalid keys, write rejections, external dispatch with adapter, MYBA endpoint without contracts service), adapter registry / mock / memoize.

  **`@voyantjs/charters-react`** — React Query hooks + Zod fetch client:

  - ~15 hooks: `useCharterProducts` / `useCharterProduct` / `useCharterProductMutation`, `useCharterVoyages` / `useCharterVoyage`, `useCharterYachts` / `useCharterYacht`, `usePerSuiteQuote` / `useWholeYachtQuote`, `useCharterBookingMutation` (per-suite + whole-yacht — server dispatches local vs external), `useGenerateMybaContract`, `useCharterDetails` / `useRecordApaPayment` / `useReconcileApa`, plus public-surface variants.
  - Mirrors `@voyantjs/cruises-react` exactly: hierarchical query keys rooted at `["voyant", "charters"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantChartersProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail. Detail responses union local + external dispatch shapes so callers handle provenance with a discriminated check.
  - 15 unit tests across query keys, the validating fetcher (URL join, error extraction, schema mismatch handling, Content-Type defaulting), and query-option factories (URL serialisation, unified-key encoding, public-vs-admin surface routing).

  **`@voyantjs/bookings`**: no schema changes; charters integrates as a 1:1 extension table. Patch bump captures the dependency edge.

  **`@voyantjs/db`**: registers TypeID prefixes for the charter namespace (`chrt`, `chrv`, `chry`, `chst`, `chrd`).

  **`@voyantjs/ui`** (registry only — versionless): adds the `voyant-charters-*` shadcn registry components — `external-badge`, `charter-product-card` (works for both local records and external summaries), `voyage-suite-grid` (per-suite pricing matrix with category, availability badge, multi-currency price, quote/book CTA), `whole-yacht-quote-card` (charter fee + APA + total + explanatory copy; ships with a per-suite sibling), `apa-tracker` (pre-/post-charter APA reconciliation panel with collected / spent / refund / settled state). Install via `shadcn add voyant-charters-charter-product-card` etc.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/charters-module.md`.

- cc561ce: Adds the cruises module — a new opt-in vertical for cruise-selling travel agencies, designed natively against Voyant's existing module/extension/link conventions and reverse-engineered from the cross-line cruise-industry data shape (sailings, ships, decks, cabin categories, fare codes, occupancy grids, dated promo overlays, expedition enrichment programs).

  **`@voyantjs/cruises`** — full server module:

  - 13 tables: cruises, sailings, ships, decks, cabin categories, cabins, prices, price components, days, sailing-day overrides, media, inclusions, search index, enrichment programs.
  - Pricing: a (sailing × cabin category × occupancy × fare code) grid with per-row price components (gratuities, OBC, port charges, taxes, NCF, airfare). Soft-FKs to `@voyantjs/pricing` `priceCatalogs`/`priceSchedules` for promo overlays — no cruise-local promotions table.
  - Itinerary at two levels: `cruise_days` template + `cruise_sailing_days` per-sailing overrides (skipped ports, alternate times, ship swaps). `getEffectiveItinerary()` merges them.
  - River direction enum (`upstream | downstream | round_trip | one_way`) on sailings.
  - Expedition enrichment programs (naturalist / historian / photographer / lecturer / expert).
  - Money math (`composeQuote`) is a pure function performed in BigInt cents — supports occupancy variants, single-supplement %, second-guest pricing, and the addition/credit/inclusion price-component directions. 20 unit tests cover the math.
  - Booking integration: `booking_cruise_details` + `booking_group_cruise_details` extension tables, `cruisesBookingService.createCruiseBooking` (single cabin) and `createCruisePartyBooking` (multi-cabin via `bookingGroups` of new kind `cruise_party`). External-sailing bookings go through `createExternalCruiseBooking` which commits upstream first, then snapshots the connector booking ref.
  - **Provenance — local + external in one experience.** Cruises can be self-managed (operator owns the rows) or external (sourced through a registered `CruiseAdapter`). Admin routes use a unified-key parser that accepts both `cru_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints interleave both sources via parallel `Promise.allSettled` adapter fan-out. External writes return 409. `POST /:key/refresh` re-fetches; `POST /:key/detach` does a one-way snapshot to local.
  - Adapter contract (`@voyantjs/cruises/adapters`): `CruiseAdapter` interface with `listEntries` / `searchProjection` / `fetchCruise` / `fetchSailing` / `fetchSailingPricing` / `fetchSailingItinerary` / `fetchShip` / `listSailingsForCruise` / `createBooking`. Process-local registry (`registerCruiseAdapter`/`resolveCruiseAdapter`/`listCruiseAdapters`), TTL+LRU memoize decorator, and `MockCruiseAdapter` for tests. The Voyant Connect adapter is intentionally not built in this release — the contract is ready for it.
  - Search index (`cruise_search_index`): opt-in storefront projection. Local cruises are projected automatically by mutation hooks in `cruisesService`; adapters call `PUT /v1/admin/cruises/search-index/bulk` to push externals. Storefront `GET /v1/public/cruises` reads exclusively from this index for paginated/filterable browse with provenance-aware detail dispatch.
  - ~88 unit tests covering pricing math, key parsing, route validation, adapter registry, mock adapter, memoize decorator, and direction/enrichment validation.

  **`@voyantjs/cruises-react`** — React Query hooks + Zod fetch client:

  - ~25 hooks: `useCruises` / `useCruise` / `useCruiseMutation`, `useSailings` / `useSailing` / `useSailingMutation`, `useShips` + ship-detail family, `usePrices` / `useQuote`, `useCruiseBookingMutation` (single + party), `useEnrichmentPrograms` / `useEnrichmentMutation`, `useExternalCruiseActions` (refresh / detach), `useSearchIndexMutation`, `useStorefrontCruises` / `useStorefrontCruise` / `useStorefrontSailing`.
  - Mirrors `@voyantjs/crm-react` and `@voyantjs/products-react` exactly: hierarchical query keys rooted at `["voyant", "cruises"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantCruisesProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail.

  **`@voyantjs/bookings`**: extends `bookingGroupKindEnum` with `cruise_party` so multi-cabin party bookings have a first-class group kind alongside `shared_room` and `other`. Pure additive; existing groups unaffected.

  **`@voyantjs/db`**: registers TypeID prefixes for the cruise namespace (`cru`, `crsl`, `crsh`, `crdk`, `crcc`, `crcb`, `crpx`, `crpc`, `crdy`, `crsd`, `crme`, `crin`, `crsi`, `crep`).

  **`@voyantjs/ui`** (registry only — versionless): adds the `voyant-cruises-*` shadcn registry components — `external-badge`, `cruise-card`, `cruise-list`, `pricing-grid` (the load-bearing cabin × occupancy matrix), `quote-display`, `enrichment-program-list`. Install via `shadcn add voyant-cruises-cruise-card` etc.

  **Example app** (`examples/nextjs-booking-portal`): adds `/cruises` listing + `/cruises/[slug]` detail pages backed by `/v1/public/cruises`, with mock data showing the local-vs-external dual-source UI.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/cruises-module.md` (745 lines).

  - @voyantjs/core@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/core@0.11.0

## 0.10.0

### Minor Changes

- 29a581a: Add `Idempotency-Key` header protocol for non-idempotent booking-creation endpoints.

  Same key + same body replays the original response; same key + different body returns `409 Conflict`. Records expire after 24h. Wired (with `required: false` default) into:

  - `POST /v1/admin/bookings/`
  - `POST /v1/admin/bookings/reserve`
  - `POST /v1/admin/bookings/from-product`
  - `POST /v1/admin/bookings/from-offer/:offerId/reserve`
  - `POST /v1/admin/bookings/from-order/:orderId/reserve`
  - `POST /v1/public/bookings/sessions`
  - `POST /v1/public/bookings/sessions/:sessionId/confirm`

  Ships:

  - `idempotency_keys` table in `@voyantjs/db/schema/infra` keyed by `(scope, key)`, with body-hash, captured response, and TTL.
  - `idempotencyKey({ scope, required? })` middleware in `@voyantjs/hono` that reads the header, replays/conflicts/expires, and captures `2xx` JSON responses. Echoes `Idempotency-Key` + `Idempotency-Replayed: true` on replay.
  - `purgeExpiredIdempotencyKeys()` helper for daily-cron cleanup.

  Backwards-compatible: clients without the header continue to work. Templates can flip a route to `required: true` per endpoint once their client has rolled out.

### Patch Changes

- @voyantjs/core@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/core@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/core@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/core@0.6.9

## 0.6.8

### Patch Changes

- b218885: Add a composite Better Auth membership index for workspace organization access paths.
  - @voyantjs/core@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/core@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4

## 0.6.3

### Patch Changes

- d3c6937: Add a narrow execution lock surface and use it to serialize worker-driven notification reminder sweeps across processes.
- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0

## 0.5.0

### Patch Changes

- ce72e29: Add a shared-room / split-booking group model

  Multiple separate bookings can now intentionally share one room/accommodation while each booking keeps its own finance + traveler records. Inspired by the ProTravel v3 `sharing_groups` pattern: flat peer bookings, a lightweight `booking_groups` + `booking_group_members` schema, smart cleanup on cancellation.

  `@voyantjs/bookings`: new `bookingGroups` and `bookingGroupMembers` tables (TypeID prefixes `bkgr` / `bkgm`), service functions for CRUD plus reverse lookup, unified traveler list across members, and automatic group dissolution when a cancellation leaves ≤1 active members. New routes under `/v1/bookings/groups` plus the REST-nested `GET /v1/bookings/:id/group`.

  `@voyantjs/bookings-react`: hooks for `useBookingGroups`, `useBookingGroup`, `useBookingGroupForBooking`, `useBookingGroupMutation`, and `useBookingGroupMemberMutation` (stateless — accepts `groupId` per-call so create-then-add flows work with a single hook instance).

  `@voyantjs/db`: register TypeID prefixes `bkgr` (booking_groups) and `bkgm` (booking_group_members).

  - @voyantjs/core@0.5.0

## 0.4.5

### Patch Changes

- e3f6e72: Standardize TypeID prefixes to a first-N-chars convention for better DX.

  Root entities now use the shortest unambiguous first-N chars of the entity name
  (e.g. `pers` instead of `prsn`, `org` instead of `orgn`). Child entities use a
  2-char module code plus 2-char suffix. 19 prefixes renamed in total.

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/core@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Enrich the public customer-portal profile with middle name, top-level
  date-of-birth/address fields, consent provenance/source, and encrypted travel
  document reads/writes backed by `user_profiles.documentsEncrypted`.
  - @voyantjs/core@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add first-class public booking-session wizard state and storefront repricing.

  `@voyantjs/bookings` now persists wizard session state in `booking_session_states`,
  includes that state in public session reads, exposes public state read/write
  routes, and adds `POST /v1/public/bookings/sessions/:sessionId/reprice` for
  previewing or applying room/unit repricing back onto the booking session.

  `@voyantjs/bookings-react` now exports public session/state query helpers and a
  mutation helper for session state updates and repricing.

- 8566f2d: Add a first-class public storefront verification flow with email and SMS
  challenge start/confirm routes, pluggable developer-supplied senders, and
  built-in notification-provider adapters including Resend email and Twilio SMS.
  - @voyantjs/core@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/core@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1

## 1.1.11

## 1.1.1

## 1.1.0

### Minor Changes

- [#292](https://github.com/voyantjs/voyant/pull/292)
  [`d799492`](https://github.com/voyantjs/voyant/commit/d799492fabc7789315d614af4bb2f3a58804ce10)
  Thanks [@mihaipxm](https://github.com/mihaipxm)! - Initial SDK release
