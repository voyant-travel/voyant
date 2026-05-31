# ADR-0002: Pure framework contracts ship as standalone `*-contracts` packages

- **Status:** Accepted (2026-05-31)
- **Relates to:** [#1400](https://github.com/voyantjs/voyant/issues/1400), [#1411](https://github.com/voyantjs/voyant/issues/1411)

## Context

Voyant's domain packages (`catalog`, `cruises`, `accommodations`, `products`,
`extras`, `charters`, …) each carry two very different kinds of code in one
package:

1. **Pure contracts** — Zod schemas, inferred types, schema-version
   constants, validators, and small enum vocabularies. These describe the
   payload shapes that flow across HTTP/queue/RPC boundaries (the source-adapter
   contract, the `<vertical>/v1` rich-content aggregates).
2. **Runtime** — Drizzle tables, Hono routes, services, booking engines,
   catalog-projection policies, content-resolution read paths, adapter shims.

External consumers increasingly need (1) without (2):

- **Voyant Connect** validates provider mappers and `SourceAdapter` HTTP
  responses against the framework contracts. It must not pull Drizzle, Hono,
  or framework DB modules into its own runtime.
- **Third-party adapter authors** need a stable, small public surface that says
  "emit/consume these payloads" without implying they run the framework.
- **The Admin API SDK** (#1411) is explicitly specified as follow-up that
  "depends on #1400 for the reusable contract-package pattern."

Before this ADR, importing `cruiseContentSchema` meant depending on
`@voyantjs/cruises` — and transitively on `@voyantjs/catalog`,
`@voyantjs/db`, `@voyantjs/hono`, Drizzle, and Hono. The pure contract was
real but not *reachable* without the runtime.

## Decision

**Pure framework contracts live in dedicated, dependency-light `*-contracts`
packages. Runtime packages depend on their contracts package and re-export
from it; the dependency arrow only ever points runtime → contracts.**

Concretely:

- The shared source-adapter contract surface lives in
  **`@voyantjs/catalog-contracts`** (adapter contracts, adapter Zod schemas,
  field-policy contracts, provenance, drift event payloads, and the pure
  content locale/overlay primitives).
- Each vertical with a `<vertical>/v1` rich-content aggregate ships
  **`@voyantjs/<vertical>-contracts`** owning that aggregate: the
  `*_CONTENT_SCHEMA_VERSION` constant, every content schema, the inferred
  types, the `validate<Vertical>Content` validator, and any pure facet
  vocabularies (e.g. the cruise cabin bed/accessibility/view enums).
- The runtime `@voyantjs/<vertical>` package keeps a `content-shape.ts` that
  **re-exports** the whole contract surface, so existing
  `@voyantjs/<vertical>/content-shape` and `@voyantjs/<vertical>` import paths
  are unchanged.
- `*-contracts` packages depend on **`zod` only** (plus, at most,
  `@voyantjs/catalog-contracts`, which is itself zod-only). They never depend
  on `@voyantjs/db`, `@voyantjs/hono`, `drizzle-orm`, `hono`, or any runtime
  package.

### What is "pure" (goes in `*-contracts`)

- `*_CONTENT_SCHEMA_VERSION` constants.
- Content/payload Zod schemas and their `z.infer` types.
- `validate<Vertical>Content`-style validators (safeParse → tagged result).
- Pure enum/vocabulary constants used by the schemas (cabin facets, etc.).

### What stays in the runtime package

- Drizzle tables, Hono routes, services, booking engines, catalog-projection
  policies, content read/refresh paths, adapter shims.
- The **overlay-merge composition** `mergeOverlaysInto<Vertical>Content`. It
  composes the catalog overlay applier with the vertical validator and is a
  read-path concern; keeping it in the runtime lets the contract package stay
  strictly zod-only and free of any `@voyantjs/catalog*` dependency. (The pure
  overlay applier itself, `mergeOverlaysIntoContent`, lives in
  `@voyantjs/catalog-contracts`; the runtime composition is the thin wrapper.)

### Coverage as of this ADR

`catalog`, `cruises`, `accommodations`, `products`, `extras`, and `charters`
all have a `*-contracts` package. Any new vertical that introduces a
`<vertical>/v1` content aggregate ships its `*-contracts` package in the same
change.

## Consequences

### Positive

- **External consumers depend on a small, stable surface.** Connect, adapter
  authors, and the future Admin SDK import `@voyantjs/<vertical>-contracts`
  (zod + the schema) instead of the full runtime tree.
- **One source of truth.** The schema is defined once in the contracts package
  and re-exported; there is no second copy to drift. (This ADR's rollout also
  collapsed a duplicated copy of the catalog content primitives.)
- **Import paths are preserved.** Internal code and existing dependants keep
  importing from `@voyantjs/<vertical>` unchanged — the runtime re-export
  stub is API-compatible.
- **Contract versioning is explicit.** The `<vertical>/v1` constant and schema
  ship in a package whose version and changelog are about the contract, not
  the runtime.

### Negative

- **More packages.** Each vertical with a content aggregate is now two packages
  instead of one. That is more `package.json`/`tsconfig`/`changeset` surface
  and a slightly larger workspace graph.
- **A re-export indirection.** Reading a vertical's content shape means hopping
  from the runtime stub to the contracts package. Mitigated by the stub being
  a trivial, uniform file.
- **Two places to look when adding a field.** A new content field is added in
  the contracts package; if it needs a runtime projection it is wired in the
  runtime package. The split is deliberate but must be understood.

### Mitigations

- **Uniform recipe.** Every `*-contracts` package is structurally identical
  (`package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`,
  `src/index.ts`, `src/content-shape.ts`, `src/content-shape.test.ts`), so the
  extraction is mechanical and reviewable. See "How to apply" below.
- **CI guards the boundary.** `pnpm verify:package-exports` checks the export
  maps; typecheck across the workspace proves the runtime re-exports stay
  API-compatible.

## Alternatives considered

### Alternative A: Keep contracts inside runtime packages (status quo ante)

Leave schemas in `@voyantjs/<vertical>` and ask consumers to depend on the
runtime package. **Rejected** — it forces Connect and adapter authors to pull
Drizzle/Hono/DB into environments that never run the framework, and makes the
Admin SDK (#1411) impossible to build without the same bloat.

### Alternative B: One mega `@voyantjs/contracts` package

Put every vertical's contracts in a single package. **Rejected** — it couples
unrelated verticals into one version/changelog, and a consumer that only needs
`cruises/v1` would still install `accommodations/v1`, `products/v1`, etc. The
per-vertical split mirrors the runtime package boundaries consumers already
reason about.

### Alternative C: Put the overlay-merge composition in the contracts package

Move `mergeOverlaysInto<Vertical>Content` into `*-contracts` too, making the
contract package depend on `@voyantjs/catalog-contracts`. **Rejected for now**
— it widens the contract package's dependency beyond zod for a helper that is a
read-path concern, not a payload contract. The pure overlay applier is already
available from `@voyantjs/catalog-contracts` for any consumer that wants to
apply overlays itself. Revisit if an external consumer needs the composed
helper without the runtime.

## How to apply this decision

When a vertical introduces (or already has) a `<vertical>/v1` content
aggregate, ship `@voyantjs/<vertical>-contracts` alongside it:

1. Create `packages/<vertical>-contracts/` mirroring any existing
   `*-contracts` package: `package.json` (zod-only deps, `.` + `./content-shape`
   exports, `publishConfig`), `tsconfig.json`, `vitest.config.ts`, `README.md`,
   `src/index.ts` (`export * from "./content-shape.js"`).
2. Move the **pure** content into `src/content-shape.ts`: the version constant,
   schemas, types, validator, and any pure facet vocabularies. No
   `@voyantjs/catalog` import; `zod` only.
3. Add a `src/content-shape.test.ts` smoke test (version constant + a valid and
   an invalid payload).
4. Replace the runtime `packages/<vertical>/src/content-shape.ts` with a
   re-export stub: re-export the whole surface from
   `@voyantjs/<vertical>-contracts/content-shape`, keep
   `mergeOverlaysInto<Vertical>Content` defined locally.
5. Add `"@voyantjs/<vertical>-contracts": "workspace:*"` to the runtime
   package's dependencies.

When you are tempted to import a schema from a runtime package into an external
consumer (Connect, an adapter, a Max tool, the Admin SDK), **stop and import
from the `*-contracts` package instead.** If the contract you need isn't in a
`*-contracts` package yet, extracting it is the task — not depending on the
runtime.
