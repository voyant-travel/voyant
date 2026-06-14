# Voyant Cross-Module Indexing And Projection Policy

This guide defines how Voyant should treat cross-module indexing, denormalized
read models, and projections.

The goal is simple:

- keep application-layer traversal as the default cross-module read model
- treat projections as explicit derived read models, not hidden infrastructure
- require ownership, freshness, and rebuild rules for every projection
- avoid inventing a platform-wide projection engine before one concrete read
  path justifies it

This promotes a narrower active policy than the deferred idea in
[`future-architecture-considerations.md`](./future-architecture-considerations.md).
It does not introduce general projection infrastructure.

## Core Rules

### 1. Application-layer traversal remains the default

Voyant already has a working default for cross-module reads:

- entity fetchers
- typed link definitions
- runtime link-service traversal
- in-memory stitching through the query graph

That is the baseline model today.

Rule:

Treat application-layer traversal as the default cross-module read path unless
measured evidence proves one specific read path needs more.

### 2. A projection is a derived read model, not a second source of truth

If Voyant adds a projection, it should be understood as:

- denormalized read support
- query acceleration for one expensive path
- an explicitly derived representation of canonical module-owned data

It should not become the place where primary business truth silently moves.

Rule:

Keep projections derived and disposable; canonical state still belongs to the
owning module tables.

### 3. Not every expensive read needs a projection

Before adding a projection, Voyant should first consider:

- better indexes on module-owned tables
- cleaner fetcher behavior
- narrower query shape
- caching for repeatable response-shaped data

Rule:

Do not jump to projection infrastructure when ordinary indexing, query-shaping,
or caching can solve the real bottleneck more simply.

### 4. One projection means one owner

A projection needs someone to own:

- the shape
- the rebuild logic
- freshness expectations
- failure behavior

That ownership can be framework-level, module-level, or app-level depending on
the read model, but it cannot be anonymous.

Rule:

Every projection must have an explicit owner; there is no such thing as a
"neutral" denormalized read model.

## Current Runtime Baseline

### 5. The query graph is the current cross-module read contract

Today's cross-module read runtime is centered on `@voyant-travel/core/query` and the
link runtime, not on precomputed projections.

That means Voyant currently expects:

- base records from module-owned fetchers
- link lookups through the shared link service
- linked record hydration through registered target fetchers
- final read shaping in runtime code

Rule:

Assume the query graph is the current contract until a specific projection is
introduced for a specific read path.

### 6. Projections are different from cache entries

Voyant's caching architecture already allows:

- expensive but repeatable read models
- response-shaped caching
- derived public/storefront payload caching

That does not automatically mean those read paths need durable indexed
projections.

Rule:

Keep cache entries and projections conceptually separate: a cache is
best-effort acceleration, while a projection is an owned derived read model.

### 7. Search-oriented and filter-oriented read models need explicit justification

The most plausible future reasons for projections are:

- cross-module search
- large linked filters
- denormalized public/storefront query performance

Those are valid future pressures, but they are not the current baseline.

Rule:

Do not describe search-oriented or filter-oriented projection needs as if they
already define the framework's default architecture.

## Promotion Threshold For Projections

### 8. Promote only with a concrete measured read path

A projection becomes justified only when one read path shows real pressure such
as:

- repeated slow linked traversals on real workloads
- search/filter behavior that cannot be supported acceptably through current
  traversal defaults
- a public/admin read model whose latency or cost materially improves with
  denormalization

Rule:

Require one concrete measured read path before introducing one projection.

### 9. The first projection slice must stay narrow

If Voyant introduces a projection, the first slice should define:

- one target read model
- one owner
- one freshness contract
- one rebuild/backfill path
- one invalidation or recompute trigger story

Rule:

Do not respond to the first projection need by building a universal projection
engine.

## Product Guidance

### 10. Framework-level projections should be rare and obvious

Most read optimizations should stay in:

- module-owned indexing
- app-owned caching
- query/fetcher improvements

Framework-level projections should exist only when they truly support a shared
platform read model that downstream apps would otherwise keep rebuilding.

Rule:

Only elevate a projection to framework level when the read model is genuinely
shared.

### 11. Public/storefront projections must keep contract ownership explicit

Public and storefront read paths may eventually justify projections for:

- faceted discovery
- denormalized catalog reads
- availability or pricing search surfaces

If that happens, the shared public contract still has to stay explicit about:

- where freshness comes from
- what is derived
- what fallback behavior exists

Rule:

Do not hide public/storefront denormalization behind undocumented read-model
magic.

### 12. Module APIs should not leak projection internals

Modules and routes should continue exposing business-oriented contracts, not
whether a result came from:

- direct fetcher traversal
- cached response shaping
- a future projection table or index

Rule:

Projection internals belong behind shared runtime surfaces, not in public
module contracts.

## Practical Checklist

When considering a projection in Voyant:

1. Confirm the current traversal model is the actual bottleneck.
2. Rule out simpler fixes first: indexes, query shape, fetcher changes, cache.
3. Name one concrete read model that needs denormalization.
4. Define explicit ownership, freshness, and rebuild behavior.
5. Keep the first projection family-specific instead of introducing a platform
   engine.

## Non-Goals

This guide does not introduce:

- a universal projection engine
- automatic denormalization for every cross-module relationship
- a replacement for the current query-graph traversal model

The point is disciplined promotion of one explicit derived read model at a
time, not a larger indexing framework.
