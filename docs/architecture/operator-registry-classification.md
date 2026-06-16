# Operator registry classification (Phase 2 / Workstream B prerequisite)

- **Status:** Draft
- **Date:** 2026-06-16
- **Feeds:** `consolidated-deployments-rfc.md` → Workstream B (`createOperatorApp`).

Before relocating the composition registry into a versioned `createOperatorApp`, every
entry must be classified — **standard framework** (moves into the `createOperatorApp`
default set, with deployment specifics injected as `providers`) vs **deployment-local**
(stays in the deployment, passed via `extensions[]`). Relocating before classifying is
how operator-specific choices get baked into the framework package — the failure mode
this whole effort exists to avoid.

Source: `starters/operator/src/api/composition.ts` `OPERATOR_RUNTIME_MANIFEST`.

## `@voyant-travel/*` entries — all STANDARD (no judgment needed)

The 21 mounted `@voyant-travel/*` modules (action-ledger, relationships, quotes,
operations, identity, distribution, inventory[/extras], bookings[/requirements],
commerce, catalog, finance, legal, public-document-delivery, notifications,
storefront[/customer-portal][/verification], trips, flights) and the 8 `@voyant-travel/*`
extensions (bookings/booking-supplier, finance/bookings-create, inventory/booking,
inventory/authoring, quotes/booking, distribution[/channel-push], finance/booking-tax)
are **package-delivered** — they are the `createOperatorApp` default set by definition.
A deployment removes one by omitting it from `config.modules`.

## `operator/*` entries — the judgment calls

### Modules

| Entry | Bucket | Routes/logic live in | Deployment injects / why |
| --- | --- | --- | --- |
| `operator/mcp` | **Standard** | `@voyant-travel/trips/mcp` | tool context (tenant id, default slices) + trips service — a Voyant AI feature, context-injected |
| `operator/catalog-booking` | **Standard** | `@voyant-travel/catalog` (booking engine) | connect client, source registry, owned handlers, tax settings |
| `operator/catalog-content` | **Standard** | `@voyant-travel/catalog` (content) | connect client, Typesense |
| `operator/media` | **Standard** | `@voyant-travel/storage` + `inventory/brochure` | R2 storage, video-upload signer, brochure printer |
| `operator/payment-link` | **Standard** | `@voyant-travel/storefront/payment-link` | card-payment seam, bank-transfer config, trip-data readers |
| `operator/contract-document` | **Standard** | `@voyant-travel/legal` (contract-document) | PDF engine, document storage, PII service |
| `operator/invitations` | **Deployment-local** | `src/routes/invitations` | Better-Auth team-invitation glue — coupled to the deployment's auth client |
| `operator/operator-settings` | **Deployment-local** (extract candidate) | `src/routes/settings` + `src/db/schema.ts` | the operator's own settings schema/data (deployment-owned tables). **See recommendation below** |

### Extensions

| Entry | Bucket | Logic | Deployment injects |
| --- | --- | --- | --- |
| `operator/booking-schedule-extension` | **Standard** | bookings deposit/balance scheduling + public payment-policy route | payment-policy cascade readers, settings |
| `operator/quote-version-snapshot-extension` | **Standard** | trips/quotes version snapshot | reserve/snapshot deps |
| `operator/booking-maintenance-extension` | **Standard** | bookings `rebuild-tax-lines` (currently inline) | finance tax recompute |
| `operator/action-ledger-health-extension` | **Standard** | action-ledger drift health | injected per-vertical drift checks |
| `operator/proposal-extension` | **Standard** | quotes proposal lifecycle (send/accept/decline) | reserveTrip/startCheckout deps, public base URL |
| `operator/catalog-offers-extension` | **Standard** | `@voyant-travel/catalog` offers | connect client, Typesense, airport labels |
| `operator/catalog-checkout-extension` | **Standard** | `@voyant-travel/catalog` checkout | card-payment seam, tax settings, bank-transfer |

## Result

- **13 of 15 `operator/*` families are STANDARD** — their routes/logic are already
  package-owned (or trivially generalizable), and they're `operator/*` today only
  because the *provider wiring* lived in the deployment. Under `createOperatorApp` they
  join the default set, with the deployment supplying providers via injection (the
  card-payment seam, connectors, storage, settings readers — all already injection-shaped
  from earlier waves).
- **2 are genuinely DEPLOYMENT-LOCAL**, passed via `extensions[]`:
  - `operator/invitations` — Better-Auth team-invitation glue (auth-client-specific).
  - `operator/operator-settings` — the deployment owns its settings schema/data.

So the `createOperatorApp` shape is well-founded: a large config-driven default set + a
small, well-defined `extensions[]` (today just invitations + settings) + the injected
`providers`. No operator-specific choice gets baked into the framework.

## Recommendation: extract `operator-settings` to a standard package

`operator/operator-settings` is classified deployment-local because its schema lives in
the deployment — but it's a **strong extraction candidate**. So many standard modules
already depend on injected *settings readers* (`resolveBookingTaxSettings`,
`resolveOperatorProfile`, `resolveOperatorPaymentInstructions`, bank-transfer config…)
that a canonical `@voyant-travel/operator-settings` package — owning a standard settings
schema + the reader contract — would collapse a large amount of per-deployment injection
into one packaged module. It would move from `extensions[]` into the default set, and the
deployment would only override the *values*, not re-wire the readers. Worth its own small
design note before `createOperatorApp` finalizes the provider surface.
