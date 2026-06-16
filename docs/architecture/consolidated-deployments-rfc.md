# RFC: Consolidated deployments — deployment-as-config with a seamless upgrade path

- **Status:** Draft
- **Author:** Platform
- **Date:** 2026-06-16
- **Related:** `api-route-ownership-and-composition.md`, `api-route-authoring.md`, ADR-0001 (tenant scoping)

## Summary

Today every client project is a **fork** of `starters/operator`. The fork carries hand-wired framework glue (the composition registry, the admin nav/icon/destination maps, deployment-generated migrations), so upgrading Voyant means a manual merge of that glue per client — and it silently drifts.

This RFC proposes inverting the relationship: the **framework becomes a versioned application** that a deployment consumes through three stable contracts — **config, injected providers, and extensions** — and the deployment owns no framework glue. The result:

- **80% "standard" clients** upgrade by bumping package versions and running migrations. No code merge.
- **20% "custom" clients** layer their customizations through defined extension seams (`src/modules`, `src/api`, `src/admin`, `src/links`, custom fields) and reconcile only *their own* code on upgrade — never framework internals.

The model is the prevailing config-driven, package-owned-module backend-framework pattern, adapted for Voyant's three hard constraints: **Cloudflare Workers** (build-time composition, not Node runtime resolution), **Drizzle** (no cross-package migration discovery out of the box), and **changesets** (already in use).

This RFC supersedes part of the "no central assembly package" decision: that decision correctly rejected a package that *baked provider choices* and shoveled runtime files bottom-up. This proposal keeps providers **injected** (the card-payment / connector seams already shipped) — what moves into versioned packages is the *config-driven assembly*, never the provider choices.

## Goals

1. A standard deployment is **config + provider wiring only** — no hand-maintained composition, nav, or migration glue.
2. Upgrading a standard deployment is `bump versions → migrate → doctor`, with **no merge of framework-owned files**.
3. Custom deployments extend through **first-class seams**, never by editing framework-owned files, so their upgrade path is the standard one plus *their* deltas.
4. Provider specifics (Netopia, connectors, storage) stay **injected** and deployment-owned.

## Non-goals

- Multi-tenancy in-process. Per ADR-0001, one DB + one runtime per client stays. "Not a fork" ≠ "multi-tenant"; it means the per-client deployment is a thin config consumer, not a framework copy.
- Removing the ability to self-host a fully custom stack. The fork remains *possible*; it stops being *mandatory*.

## Where we are today (grounded)

| Concern | Current state | File |
| --- | --- | --- |
| Config manifest | Already config-shaped: `deployment`, `projectConfig`, `admin`, `modules`, `plugins`, `additionalSchemas`, `featureFlags` | `starters/operator/voyant.config.ts` |
| Composition | Hand-written manifest + registry + `buildOperatorCapabilities()` in the deployment | `starters/operator/src/api/composition.ts` |
| Providers | **Injected** via clean seams (card-payment `CardPaymentStarter`, flight connector) | `runtime/card-payment.ts`, `packages/finance/src/card-payment.ts` |
| Admin routes | **Generated** from the manifest by `voyant admin generate --routes` | `src/admin.routes.generated.tsx` |
| Admin destinations | **Generated** by `voyant admin generate --destinations` | `src/admin.destinations.generated.ts` |
| Admin extension factories | **Generated** | `src/admin.extensions.generated.ts` |
| Admin chrome (remaining) | **Hand-wired**: nav icon map + label keys + route message providers | `src/routes/_workspace/route.tsx` |
| Schemas | **Derived** from `voyant.config` → `drizzle.schemas.generated.ts` (drift-checked) | `starters/operator/drizzle.config.ts` |
| Migrations | **Deployment-generated** into one combined folder + journal; one derived schema set + one migration history; cross-module link tables folded in (`drizzle.links.generated.ts`); not package-owned | `starters/operator/migrations/`, `scripts/migrate.ts`, `migration-resilience-rfc.md` (#1608) |
| Versioning | changesets with **per-domain `fixed` groups** (`[module, module-react]`); domains version independently | `.changeset/config.json` |
| Drift guard | `voyant db doctor --fail-on-drift` gates CI (manifest resolvability, schema parity, generated-manifest freshness, duplicate prefixes, link-table snapshot) | CLI, `schema-discipline.md` |

The foundation is much further along than the "fork" framing suggests: config, schema derivation, **route + destination + extension-factory generation**, provider injection, and a CI-gating doctor already exist. The remaining gaps are narrower than first stated and concentrate in **the last hand-wired chrome (icons/labels/message-providers) + `src/admin` discovery**, **migration ownership**, and **version/assembly consolidation**.

## Target model

The deployment shrinks to its identity — config, the providers it chose, and the 20% it added:

```ts
// the entire standard deployment, conceptually
export default createOperatorApp({
  config:     voyantConfig,                                  // branding, locale, modules, flags
  providers:  { card: netopiaCardStart, storage: r2(env), flights: demoConnector(env) },
  extensions: [],                                            // 20% custom — never framework-owned files
})
```

`createOperatorApp` is a **versioned framework package**. It reads `config` to assemble the standard module set (the registry that lives in `composition.ts` today moves here), derives the admin chrome from module-shipped metadata, mounts the generated routes, and wires the deployment's injected providers and extensions. The deployment file becomes ~20 lines and contains no glue that can drift.

## Workstreams

Five workstreams, ordered later by risk and dependency.

### A. Framework-wide lockstep versioning — *cheap, decision-led*

**Current:** per-domain `fixed` groups → a per-domain compatibility matrix (bookings\@X, finance\@Y, legal\@Z).

**Target:** one framework-wide group so the runtime framework packages move as a single version. A bare `@voyant-travel/*` glob is **wrong** — that namespace also contains React packages, `*-contracts`, plugins, infra (`db`, `hono`, `core`, `utils`), apps, and tooling, which should not be force-bumped or pinned by deployments at the framework version.

**Mechanically-defined set, not a glob.** Define the lockstep membership by a *rule the checker can evaluate*, e.g. "every workspace package that exports a `HonoModule`/`HonoExtension` and is listed (transitively) by `voyant.config` `modules`/`additionalSchemas`," and emit it to a committed `release.runtime-packages.generated.json`. Then:

```json
"fixed": [[ /* expanded from release.runtime-packages.generated.json */ ]]
```

Add a **`check-lockstep-membership` gate**: expand the glob/rule, diff against the committed set, and **fail if a non-runtime package (React/contracts/plugins/infra/apps/tooling) enters the fixed group** or a runtime module is missing. The React/contracts/plugin packages keep their existing per-domain `fixed` pairs or release independently so external consumers pin them on their own cadence.

**Tradeoff to decide:** per-domain independence allows shipping one domain without bumping everything; framework-wide lockstep makes deployment upgrades atomic at the cost of more churn per release. Recommendation: **framework-wide lockstep for the runtime-module set only**, defined mechanically as above.

**Effort:** low (config + the membership checker + release-process agreement).

### B. `createOperatorApp(config, { providers, extensions })` — *medium*

Move the standard composition (`OPERATOR_RUNTIME_MANIFEST` + `operatorComposition` registry) out of the deployment and into a versioned framework package, **driven by `voyant.config`**. `buildOperatorCapabilities()` splits cleanly:

- **Config-derived** wiring (which modules, mount order, surfaces) → framework, derived from `config.modules`.
- **Provider/deployment** wiring (db, env, KMS, the injected `CardPaymentStarter`, connectors) → stays in the deployment, passed as `providers`.

**Ownership classification (prerequisite, not an afterthought).** The registry today contains many deployment-local families under `operator/*` — e.g. `operator/mcp`, `operator/invitations`, `operator/catalog-booking`, `operator/catalog-content`, `operator/media`, `operator/payment-link`, `operator/operator-settings`, `operator/contract-document`, and extensions `operator/booking-schedule-extension`, `operator/quote-version-snapshot-extension`, `operator/booking-maintenance-extension`, `operator/action-ledger-health-extension`, `operator/proposal-extension`, `operator/catalog-offers-extension`, `operator/catalog-checkout-extension`. Before any relocation, each registry entry must be classified:

- **Standard framework module** — belongs to a package, becomes part of the `createOperatorApp` default set (e.g. payment-link, contract-document, media if they generalize).
- **Deployment-local extension** — operator-specific wiring that stays in the deployment and is passed via `extensions` (e.g. `operator/invitations` Better-Auth glue, `operator/operator-settings`).

Produce this classification table as the **first deliverable of Workstream B**. Relocating before classifying is exactly how operator-specific choices get baked into the framework package — the failure mode this RFC exists to avoid.

This is *not* the rejected "kit": providers are injected, not baked, and the assembly is config-driven rather than a bottom-up file dump. Keep composition **build-time** (Workers constraint — see E).

**Effort:** medium. The manifest/registry already exist; this relocates and parameterizes the *classified-as-standard* subset.

### C. Admin chrome derivation + `src/admin` discovery — *medium*

**Current (corrected):** admin **routes, destinations, and extension factories are already generated** (`admin.routes.generated.tsx`, `admin.destinations.generated.ts`, `admin.extensions.generated.ts`). The remaining hand-wired surface in `src/routes/_workspace/route.tsx` is narrow: the **nav icon map**, the **i18n label keys** passed to the extension factory, and the **route message providers**. So this workstream is mostly *finishing* an existing trajectory, not building it.

**Target (remaining gaps only):**
1. **Modules ship the last metadata** — nav icon + label key (+ message provider) move into each module's packaged admin metadata so they're generated like destinations/extensions already are. Adding a module to `config.modules` then auto-contributes its full nav entry; the icon map and label list leave `route.tsx`.
2. **`src/admin/` discovery for the 20%** — custom admin pages (UI routes with `{ label, icon }` config) and widgets (injected into named zones) auto-discovered from the deployment's `src/admin/`, mirroring the existing generated mechanism. Nav for custom pages is derived from their config, never hand-registered.
3. **Checker hardening** — extend `voyant db doctor`/`admin generate` drift checks so a module present in `config.modules` but missing an icon/label/destination (or vice-versa) fails CI. This is what makes upgrades safe: a new upstream domain can't silently vanish from the nav.

**Effort:** medium, trending low — the generated-routes/destinations/extensions machinery already proves feasibility; this extends it to the last metadata + a `src/admin` discovery pass + checker coverage.

### D. Package-owned migrations + a Drizzle collector/orderer — *hard (the crux)*

This is the section that decides whether "seamless upgrade" is real, and the one delta the reference framework gets for free from its ORM that Voyant must **build** on Drizzle. **It is the blocker: resolve it as a standalone architecture decision (an ADR) before this RFC becomes implementation tickets.**

> **Supersession (explicit).** This workstream **amends `migration-resilience-rfc.md` (voyant#1608) and the "Migration generation & ordering" section of `schema-discipline.md`.** Those establish the current source of truth: the deployment manifest derives **one** `drizzle.schemas.generated.ts` and the deployment owns **one** migration history (timestamp-prefixed, with cross-module link tables folded into `drizzle.links.generated.ts`, gated by `voyant db doctor --fail-on-drift`). Moving migration *ownership* from the deployment to packages changes that source of truth and must not land as an implementation detail — it needs its own ADR that either supersedes #1608 or is rejected in favor of keeping the single-history model. **If the ADR keeps deployment-owned history, Workstreams A–C still deliver the bulk of "deployment-as-config" without it** (see Phasing — D is deliberately last and independently gateable).

**Current:** the deployment generates one combined migration folder + journal from the *aggregate* schema (module closures + `additionalSchemas` + starter-local `schemas` + the **deployment-generated cross-module link tables**). Upgrading a module changes its schema, but new migrations do **not** ship with the package — the deployment must regenerate. That breaks "bump + migrate."

**Target:** module-authored migrations are **owned by packages** and **collected + ordered** by the deployment's runner — with the deployment still owning the schema that is inherently deployment-level.

The spike (ADR) must define, concretely:

1. **Ledger keys.** The applied-migration ledger keys each migration by `(source, tag, contentHash)` — `source` = `package@version` or `deployment`; `contentHash` detects a package shipping a *changed* migration under a reused tag. Extends today's single-folder `_journal.json` to a multi-source ledger table.
2. **Ordering model.** Drizzle's per-folder journal has no cross-package order. Choose among: (a) framework-assigned monotonic release tag ordered by `(release-version, in-package-sequence)`; (b) dependency-closure order derived from module dependency edges (a module's migrations apply after its dependencies'); (c) hybrid — dependency order between modules, sequence within. Lockstep (Workstream A) makes (a) viable because all framework packages share one release version.
3. **Deployment-owned schema stays deployment-owned.** Starter-local `schemas` (`src/db/schema.ts`) and the **generated cross-module link tables** (`drizzle.links.generated.ts`) are *not* package-ownable — links span modules and are deployment-composed. They remain a **deployment migration source**, anchored *after* the framework set (links reference module tables, so they must apply last).
4. **Custom-migration anchoring.** Deployment-authored migrations (`src/migrations`) declare an anchor relative to the framework set (default: after all framework migrations; optionally pinned after a specific package version's migrations for data backfills tied to a schema change).
5. **Validation against the aggregate (keep the current oracle).** `voyant db generate` stays **per-module** (a module's migration is generated against *its* schema), but the existing aggregate `drizzle.schemas.generated.ts` is **retained as the validation oracle**: an **aggregate replay test** applies *all* collected package + deployment migrations onto a fresh DB and asserts the result equals the snapshot derived from the aggregate schema. This catches cross-package drift (e.g. a module FK that assumes another module's not-yet-applied column) that per-module generation alone cannot.
6. **`voyant db doctor` extends, not replaces.** Its current checks (schema parity, generated-manifest freshness, duplicate prefixes, link-table snapshot) gain: ledger consistency, ordering determinism, and the aggregate replay test.

This lets a standard upgrade be: bump the framework version (new package migrations arrive in `node_modules`) → `voyant db migrate` (collector applies new migrations in the chosen order, links last) → `voyant db doctor` (replay test confirms aggregate parity).

**Effort:** high. Requires the standalone ADR (ordering model + ledger), the multi-source runner, the aggregate replay test, and a **compatibility shim** that keeps the current combined-folder history working during transition so existing forks aren't stranded.

### E. Workers / build-time composition — *cross-cutting constraint*

The reference framework resolves modules dynamically at Node boot. Voyant runs on Cloudflare Workers (edge isolates) and must compose at **build time** — which the manifest/registry + generated routes + the lazy-route context-bridging already lean into. `createOperatorApp` therefore assembles from a statically-known, config-derived registry (no runtime `require` of arbitrary modules). Lazy loading stays the tool for cold-start weight. No change in direction; an explicit constraint the design must honor.

## The 20% — extension seam catalog

A custom client must be able to do all of the following **without editing a framework-owned file**:

| Need | Seam | Status |
| --- | --- | --- |
| Custom domain/entity | custom module in `src/modules`, added to `config.modules` | exists (`voyant generate module`); needs `src/` discovery |
| Custom route on an existing module | `HonoExtension` / `src/api` discovery | `HonoExtension` exists; add `src/api` auto-mount |
| Custom association | `defineLink` in `src/links` | exists |
| Extra admin page / widget | `src/admin` UI route / widget discovery | **gap — workstream C** |
| Override a packaged admin page | declarative page-override seam (`detailPageComponent`, `extraPages`) | exists but undiscoverable; document + standardize |
| Custom fields on core entities | **first-class custom-fields pattern** | **gap — new design needed** |
| Provider choice (payment, storage, connector) | injected `providers` | **done** (card-payment seam, connectors) |

Two real gaps: **`src/admin` discovery** (C) and a **custom-fields pattern**. Custom fields are the single most common client ask and today force a side-table that export/invoicing don't see; the RFC should commit to a first-class approach (typed JSON column or a registered extension-field API) so it stays in the supported path.

## `voyant doctor` — the de-risking tool

A single preflight that closes the two cheapest risks and makes upgrades safe to run:

- **Env/bindings/secrets preflight** — validate required env at startup instead of failing at first use (today a missing `FLIGHTS_DEMO_API_URL` is a runtime 500). Replace placeholder detection (e.g. `replace-with-...` KV ids in `wrangler.jsonc`).
- **Composition drift** — assert `config.modules` ↔ mounted registry ↔ derived nav/icons/destinations ↔ generated routes are all in sync, and that every installed module's migrations are applied. Extends today's `voyant db doctor` schema-parity check.

`voyant doctor` is cheap, high-value, and independent of the harder workstreams — it should land first.

## Upgrade path (the actual ask)

- **Standard (80%):** `pnpm up @voyant-travel/* && voyant db migrate && voyant doctor`. No code merge — config + provider wiring are stable contracts; framework changes arrive as package updates (workstream A makes the version bump atomic; D makes migrations arrive with the packages).
- **Custom (20%):** identical, then reconcile only *their own* `src/` extensions if a seam contract changed — and semver (A) signals when. They never merge framework internals because they hold none.

## Phased plan

1. **Phase 0 — `voyant doctor` + framework-wide lockstep (A + the doctor).** Cheap, independent, immediately de-risks Acme-class engagements. Decide the lockstep tradeoff and collapse the `fixed` groups.
2. **Phase 1 — chrome derivation + `src/admin` discovery (C).** Removes the biggest silent-drift source; modules ship nav metadata; the hand-wired maps leave the deployment.
3. **Phase 2 — `createOperatorApp` (B).** Relocate the config-driven composition into the framework; deployment collapses to config + providers + extensions.
4. **Phase 3 — package-owned migrations + collector (D).** The hard one; **gated behind a standalone ADR** that supersedes `migration-resilience-rfc.md` (#1608) and fixes the ordering model + ledger, with a transition shim. This is what finally makes "bump + migrate" true — and the one phase that can be deferred or rejected without unwinding A–C.
5. **Phase 4 — custom-fields pattern + seam documentation.** Close the last 20%-without-forking gap.

Migrations are deliberately last: they are the highest-risk change and the other phases deliver value without them.

## Risks & open questions

- **Migration ownership + ordering** (D) is the main blocker. It changes the source of truth established by #1608, so it needs a **standalone ADR** (supersede or reject) before any implementation ticket — ordering model, multi-source ledger keys, deployment-owned-schema anchoring, and the aggregate replay test all decided there.
- **Lockstep tradeoff** (A) — does the team accept losing per-domain independent releases? (Recommendation: yes for runtime modules.)
- **Custom-fields design** — typed JSON column vs registered extension-field API vs per-deployment side tables with framework awareness. Needs its own mini-design.
- **Transition** — both the per-deployment combined-migration path and the package-owned path must coexist during D so existing forks aren't stranded.
- **Backwards compatibility for existing forks** — provide a `voyant migrate-deployment` codemod that converts a fork into the thin `createOperatorApp` shape.

## Relationship to prior decisions

This reconciles with — does not reverse — the "no central assembly/kit" decision. That decision rejected a package that *baked provider choices* and dumped runtime files bottom-up. Here, providers stay **injected** and deployment-owned; what moves into versioned packages is **config-driven assembly and module-owned metadata/migrations**. The deployment still chooses everything (modules, providers, extensions) — it just stops *hand-maintaining the assembly mechanics*.

It also **amends two existing migration docs**: `migration-resilience-rfc.md` (voyant#1608) and the "Migration generation & ordering" section of `schema-discipline.md`. Workstream D's package-owned-migration model changes their single-deployment-history source of truth, so it is gated behind a standalone ADR (see D) — until that ADR lands, the current deployment-owned migration model remains authoritative and Workstreams A–C are built on top of it unchanged.
