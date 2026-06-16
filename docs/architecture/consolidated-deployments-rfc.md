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
| Admin routes | **Generated** from the manifest by `voyant admin generate --routes` | `starters/operator/src/admin.routes.generated.tsx` |
| Admin chrome | **Hand-wired** 16-icon map + ~40 nav labels + 12 destination resolvers + 14 extension factories | `src/routes/_workspace/route.tsx`, `src/lib/admin-extensions.tsx`, `src/lib/admin-destinations.ts` |
| Schemas | **Derived** from `voyant.config` → `drizzle.schemas.generated.ts` (drift-checked) | `starters/operator/drizzle.config.ts` |
| Migrations | **Deployment-generated** into one combined folder + journal; not package-owned (one exception: `packages/catalog/migrations`) | `starters/operator/migrations/`, `scripts/migrate.ts` |
| Versioning | changesets with **per-domain `fixed` groups** (`[module, module-react]`); domains version independently | `.changeset/config.json` |
| Drift guard | `voyant db doctor` exists (config ↔ schema parity) | CLI |

The foundation is further along than the "fork" framing suggests: config, schema derivation, route generation, provider injection, and a doctor already exist. The gaps are concentrated in **chrome derivation**, **migration ownership**, and **version/assembly consolidation**.

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

**Target:** one framework-wide group so `@voyant-travel/*` move as a single version, e.g.:

```json
"fixed": [["@voyant-travel/*", "!@voyant-travel/<ui-libs-released-on-their-own>"]]
```

**Tradeoff to decide:** per-domain independence allows shipping a single domain quickly without bumping everything; framework-wide lockstep makes deployment upgrades atomic (`bump @voyant-travel/* to one version`) at the cost of more churn per release. Recommendation: **framework-wide lockstep for all runtime modules**, keeping standalone consumer/UI libs that consumers pin independently out of the group. This is the single biggest enabler of "bump + migrate" and it is config-only.

**Effort:** low (config + release-process agreement).

### B. `createOperatorApp(config, { providers, extensions })` — *medium*

Move the standard composition (`OPERATOR_RUNTIME_MANIFEST` + `operatorComposition` registry) out of the deployment and into a versioned framework package, **driven by `voyant.config`**. `buildOperatorCapabilities()` splits cleanly:

- **Config-derived** wiring (which modules, mount order, surfaces) → framework, derived from `config.modules`.
- **Provider/deployment** wiring (db, env, KMS, the injected `CardPaymentStarter`, connectors) → stays in the deployment, passed as `providers`.

This is *not* the rejected "kit": providers are injected, not baked, and the assembly is config-driven rather than a bottom-up file dump. Keep composition **build-time** (Workers constraint — see E).

**Effort:** medium. The manifest/registry already exist; this relocates and parameterizes them.

### C. Admin chrome derivation + `src/admin` discovery — *medium*

**Current:** routes are generated, but nav label + icon + destination resolver per domain are hand-listed — the drift source.

**Target:**
1. **Each module ships its admin metadata** (nav label key, icon, destination, injection points) alongside its packaged admin surface, so adding a module to `config.modules` auto-contributes its nav/icon/destination. The hand-wired maps in `route.tsx` / `admin-extensions.tsx` / `admin-destinations.ts` disappear.
2. **`src/admin/` discovery for the 20%** — custom admin pages (UI routes with `{ label, icon }` config) and widgets (injected into named zones) are auto-discovered from the deployment's `src/admin/`, mirroring the generated-routes mechanism. Nav for custom pages is derived from their config, never hand-registered.

**Effort:** medium. The generated-routes machinery proves feasibility; extend it to nav/icons/destinations and to a `src/admin` widget/route discovery pass.

### D. Package-owned migrations + a Drizzle collector/orderer — *hard (the crux)*

This is the section that decides whether "seamless upgrade" is real, and the one delta the reference framework gets for free from its ORM that Voyant must **build** on Drizzle.

**Current:** the deployment generates one combined migration folder + journal from the aggregated schema. Upgrading a module changes its schema, but new migrations do **not** ship with the package — the deployment must regenerate. That breaks "bump + migrate."

**Target:** migrations are **owned by packages** and **collected + ordered** by the deployment's runner.

Design sketch:
1. **Each module ships a `migrations/` folder** (as `packages/catalog/migrations` already does), with a per-module journal.
2. **`voyant db migrate` becomes a multi-source runner**: discover migration folders across installed `@voyant-travel/*` packages + the deployment's own `src/migrations`, compute a global apply order, and record applied tags in a single deployment-level ledger table (extending today's `scripts/migrate.ts` journal model from one folder to many sources).
3. **Ordering** is the hard problem (Drizzle's per-folder journal has no cross-package order). Options to evaluate in the RFC's follow-up spike:
   - a monotonic, framework-assigned migration timestamp/lamport tag per package release, ordered globally by (release-version, in-package-sequence); or
   - a declared dependency order derived from module dependency edges (a module's migrations apply after its dependencies'); or
   - a hybrid: dependency order between modules, sequence order within.
4. **`voyant db generate`** stays per-module (generate a module's migration against *its* schema), so module authors — not deployments — own schema change.
5. **Deployment-custom migrations** (`src/migrations`) interleave as just another source, applied after the framework set or at a declared anchor.

This lets a standard upgrade be: bump `@voyant-travel/*` (new package migrations arrive in `node_modules`) → `voyant db migrate` (collector applies the new ones in order) → done.

**Effort:** high. Recommend a **dedicated spike** to choose the ordering model before committing, plus a compatibility shim that keeps the current combined-folder path working during transition.

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
4. **Phase 3 — package-owned migrations + collector (D).** The hard one; gated behind a spike on the ordering model, with a transition shim. This is what finally makes "bump + migrate" true.
5. **Phase 4 — custom-fields pattern + seam documentation.** Close the last 20%-without-forking gap.

Migrations are deliberately last: they are the highest-risk change and the other phases deliver value without them.

## Risks & open questions

- **Migration ordering across packages** (D) is unsolved and ORM-fought; needs a spike before commitment.
- **Lockstep tradeoff** (A) — does the team accept losing per-domain independent releases? (Recommendation: yes for runtime modules.)
- **Custom-fields design** — typed JSON column vs registered extension-field API vs per-deployment side tables with framework awareness. Needs its own mini-design.
- **Transition** — both the per-deployment combined-migration path and the package-owned path must coexist during D so existing forks aren't stranded.
- **Backwards compatibility for existing forks** — provide a `voyant migrate-deployment` codemod that converts a fork into the thin `createOperatorApp` shape.

## Relationship to prior decisions

This reconciles with — does not reverse — the "no central assembly/kit" decision. That decision rejected a package that *baked provider choices* and dumped runtime files bottom-up. Here, providers stay **injected** and deployment-owned; what moves into versioned packages is **config-driven assembly and module-owned metadata/migrations**. The deployment still chooses everything (modules, providers, extensions) — it just stops *hand-maintaining the assembly mechanics*.
