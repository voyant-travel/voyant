# Design note: extract `@voyant-travel/operator-settings` as a standard package

- **Status:** Draft (for review — no code yet)
- **Date:** 2026-06-17
- **Feeds:** `consolidated-deployments-rfc.md` Workstream B step 4 · `operator-registry-classification.md` ("Recommendation: extract operator-settings")
- **Prereq met:** the registry relocation + `createVoyantApp` convergence (Workstream B steps 1–3) are merged. The deployment is now config + injected `providers` + two deployment-local module families (`invitations`, `operator-settings`). This note assesses turning the second one into a standard package.

## Summary

The classification doc marked `operator/operator-settings` **deployment-local** because "its schema lives in the deployment," but flagged it as a **strong extraction candidate** — so many standard modules already depend on injected *settings readers* that a canonical package owning the settings **schema + reader contract** would collapse a large amount of per-deployment injection.

Grounding that recommendation against the code: the extraction is **sound and lower-risk than the doc implied** (the `additionalSchemas` mechanism already folds package-owned schema into the deployment's migration history — no Workstream D needed), but the **collapse benefit is narrower than stated** (two of the four named readers are env-driven, not settings-table-driven). Recommendation: do it, in two stages, starting schema-only.

## Current surface (grounded)

### Schema — 5 tables, starter-local today
`starters/operator/src/db/schema.ts`:

| Table | TypeID | Notes |
| --- | --- | --- |
| `operator_settings` | `opst` | legacy catch-all, now read-only (retained for migration) |
| `operator_profile` | `oppf` | name, legal name, address, contact, licensing |
| `operator_payment_instructions` | `opin` | bank-transfer beneficiary, IBAN, bank, notes |
| `operator_payment_defaults` | `opdp` | `customerPaymentPolicy` JSONB, checkout/invoice URL templates |
| `booking_tax_settings` | `btxs` | tax pricing mode, tax policy profile id |

Wired via `voyant.config.ts` **`schemas: ["./src/db/schema.ts", …]`** (template-local), **not** `modules` or `additionalSchemas`. Migrations live in the combined starter folder (`0019_booking_tax_settings`, `0020_operator_settings_split`, `0034_operator_checkout_url_templates`).

### Readers/writers — `starters/operator/src/api/routes/settings.ts`
`get/upsertOperatorProfile`, `get/upsertOperatorPaymentInstructions`, `get/upsertOperatorPaymentDefaults`, `resolveOperatorDefaultPaymentPolicy`, `resolveBookingTaxSettings`, `updateBookingTaxSettings`, `toPublicOperatorProfile/Settings`, `mountOperatorSettingsRoutes` (admin `/v1/admin/settings/*` + public `/v1/public/operator-profile`, `/v1/public/settings/operator`).

### Who consumes the readers (the injection this would collapse)
Standard packages that today receive deployment-injected settings readers:

| Consumer (standard package) | Injected reader | Table |
| --- | --- | --- |
| `commerce` (checkout) + `finance` (booking-tax ext) | `resolveBookingTaxSettings` / `updateBookingTaxSettings` | `booking_tax_settings` |
| `legal` (contract variables) | `resolveOperatorProfile`, `resolveOperatorPaymentInstructions` | profile, payment-instructions |
| `quotes` (proposal) | `resolveOperatorProfile` | profile |
| `finance` / `notifications` (checkout) | `resolveBankTransferDetails`, `resolvePublicCheckoutBaseUrl` | **env, not tables** (see correction) |

Deployment-internal consumers (stay in the deployment regardless): `contract-document-variables.ts`, `payment-link-runtime.ts`, `catalog-checkout-options.ts`, `booking-schedule.ts`, `subscribers/smartbill.ts`.

## Correction to the classification doc

The doc lists "bank-transfer config" and (implicitly) the checkout base URL among the settings readers that would collapse. **They are env-driven, not settings-table-driven:**

- `resolveBankTransferDetails(bindings)` and `resolvePublicCheckoutBaseUrlFromBindings(bindings)` (`runtime/payment-config.ts`) read **environment bindings only**; the settings tables are a *fallback* composed by a separate helper (`bankTransferDetailsFromOperatorSettings`).

So these two `FrameworkProviders` fields **stay deployment-injected** (they're env/config, correctly deployment-owned). The genuine collapse is the **profile / payment-instructions / payment-defaults / tax-settings** readers — still a meaningful set (legal, quotes, commerce, finance), but four env-shaped fields don't move.

## Migration impact — lower-risk than flagged

The RFC and my prior note worried that moving the schema deployment→package entangles with the unbuilt migration-ownership work (Workstream D). It does **not**, because the mechanism already exists:

- `voyant.config.ts` **`additionalSchemas`** already lists *package-owned, migrated-but-not-mounted* schemas (`@voyant-travel/workflow-runs`, `accommodations`, `charters`, `cruises`). Their tables are folded into the deployment's **single combined migration history** exactly as today.
- A `@voyant-travel/operator-settings` package exporting its schema would simply move from `schemas: ["./src/db/schema.ts"]` to `additionalSchemas: […, "@voyant-travel/operator-settings"]`. Schema *definition* ownership moves to the package; **migration history ownership stays with the deployment's combined folder** (the #1608 single-history model is untouched).
- **Data stays per-deployment.** Only the schema + reader/writer *logic* is generalized — every operator deployment already has its own profile/payment/tax rows. This is no different from `bookings` (package owns the schema; each deployment owns its data).

The honest residual: the existing migrations (`0019/0020/0034`) were generated against the starter-local schema. Moving the schema must produce an **identical** generated DDL (same table/column/typeid shape) so no new migration is emitted — verified by the drift check (`voyant db schemas` parity) before merge. TypeID prefixes (`opst/oppf/opin/opdp/btxs`) are preserved verbatim.

## Proposed shape — two stages

### Stage 1 (recommended first) — schema + readers package, deployment still wires
`@voyant-travel/operator-settings` owns:
- the 5 table schemas (verbatim, same prefixes),
- the reader/writer functions (`getOperatorProfile`, `resolveBookingTaxSettings`, `updateBookingTaxSettings`, `resolveOperatorDefaultPaymentPolicy`, the upserts, the public DTO mappers),
- the Zod input schemas + `PublicOperatorProfile` type.

The deployment:
- lists it in `additionalSchemas` (schema-only; routes not yet a package module),
- imports the readers and **still injects them** into `buildOperatorProviders()` and the cross-module runtime wiring (legal/quotes/etc.) — but now from the package instead of `./routes/settings`.

**Win:** the reader *implementations* + schema are package-owned and versioned with the framework; the deployment's `./routes/settings.ts` shrinks to route handlers over package readers. **Low risk:** no composition/registry change, no new `FrameworkProviders` removal, drift-checkable.

### Stage 2 (optional) — settings becomes a standard module
Promote `mountOperatorSettingsRoutes` to a package `HonoModule` (`@voyant-travel/operator-settings` with `adminRoutes`/`publicRoutes`), move it from `additionalSchemas` to `modules`, and add its factory to `frameworkComposition`. Then:
- `operator/operator-settings` leaves `deploymentLocalModules` (only `invitations` remains there),
- the booking-tax extension + the legal/quotes/commerce settings readers can default to the package's own readers, **removing** `resolveBookingTaxSettings` / `updateBookingTaxSettings` and the operator-profile reader injections from the per-deployment surface (the deployment overrides only values/policy, not the readers).

**Win:** collapses the injection the classification doc targeted; the deployment's local-module set drops to one (`invitations`). **Risk:** introduces a real cross-package dependency (legal/quotes/commerce → operator-settings, or a shared `*-contracts` seam) and decides whether the settings *routes* are a fixed standard surface — a bigger API commitment. Worth its own slice once Stage 1 lands.

## Open questions

1. **Package vs. naming.** `@voyant-travel/operator-settings` keeps the `operator` name (it's the operator-profile/settings domain), or rename to `@voyant-travel/tenant-settings` / `@voyant-travel/organization-profile` to shed the deployment-name connotation? (The tables are operator-tenant identity + payment + tax config — generic to any deployment.)
2. **Stage-2 cross-package coupling.** Should legal/quotes/commerce depend on `@voyant-travel/operator-settings` directly, or should the reader contract live in a shared `*-contracts` package so the dependency is on the *type*, not the implementation?
3. **Env-shaped fields stay put** — confirm `resolveBankTransferDetails` + `resolvePublicCheckoutBaseUrl` remain deployment-injected `FrameworkProviders` fields (they read env, with settings tables only as fallback). This note assumes yes.
4. **`operator_settings` legacy table** (`opst`) — carry it into the package read-only (migration parity) or leave it behind as a deployment-local vestige? Leaving it behind risks a drift-check mismatch; carrying it keeps parity.

## Recommendation

Proceed with **Stage 1** (schema + readers package via `additionalSchemas`) as a self-contained, drift-checked slice — it captures most of the ownership win at low risk and is reversible. Gate **Stage 2** (standard module + injection removal) behind resolving open question 2 (the cross-package dependency seam), since it's the part that makes a real API commitment. Neither stage requires Workstream D; both keep the single combined migration history and per-deployment data.
