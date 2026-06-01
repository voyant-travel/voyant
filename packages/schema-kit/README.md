# @voyantjs/schema-kit

Foundational, dependency-light schema primitives shared by the framework runtime
**and** the `*-contracts` packages. Pure (`zod` + `typeid-js` only) — no Drizzle,
no `@voyantjs/db`, no runtime — so contract packages can depend on these without
pulling the data layer.

See [`docs/adr/0002-contract-packages.md`](../../docs/adr/0002-contract-packages.md).

## What's here

- **`./typeid`** — the canonical TypeID system: the prefix registry, id
  generation (`newId`), and the zod validators (`typeIdSchema`, `typeIdSchemas`).
  `@voyantjs/db/lib/typeid` re-exports from here, so existing import paths are
  unchanged.
- **`./query-params`** — `booleanQueryParam` and friends: pure zod helpers for
  coercing URL query-string values.
- **`./kms`** — `kmsEnvelopeSchema`: the pure zod shape for KMS-encrypted PII
  envelopes.

These were previously defined inside `@voyantjs/db`; they live here now so they
sit *below* the data layer in the dependency graph. `@voyantjs/db` re-exports
them, and the `*-contracts` packages import them directly to stay zod-only.
