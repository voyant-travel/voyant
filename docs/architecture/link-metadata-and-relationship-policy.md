# Voyant Link Metadata And Relationship Policy

This guide defines how Voyant should treat cross-module links, relationship
records, and eventual link metadata.

The goal is simple:

- keep the current link model narrow and predictable
- distinguish pair-only associations from owned relationship records
- avoid turning links into a generic graph-metadata system
- define the threshold for when richer relationship records become justified

This promotes a narrower active policy than the deferred item in
[`future-architecture-considerations.md`](./future-architecture-considerations.md).
It does not introduce generic edge metadata.

## Core Rules

### 1. The current link model stays pair-first

Voyant's current cross-module link model exists to materialize associations in
neutral territory without coupling one module's schema directly to another's.

Today that model consists of:

- a typed `defineLink(...)` contract in `@voyant-travel/core`
- generated link tables from `@voyant-travel/core/generateLinkTableSql(...)`
- runtime create/list/dismiss/delete behavior in `@voyant-travel/db/createLinkService(...)`

Those link rows currently carry:

- the left-side ID
- the right-side ID
- row identity and lifecycle timestamps

They do not carry domain-owned business metadata by default.

Rule:

Treat link rows as pair-first association records, not as generic business
objects with arbitrary edge payloads.

### 2. If the relationship has business fields, it needs an owner

Some associations eventually need more than "A is linked to B".

Examples of richer relationship data might include:

- relationship role or label
- relationship-specific status
- commercial configuration
- workflow timestamps that matter to product behavior

Once those fields become meaningful to product behavior, the relationship is no
longer only a neutral link.

Rule:

If a relationship carries real business fields, define an owned relationship
record for that family instead of stuffing arbitrary metadata onto every link.

### 3. Not every cross-module association should become a relationship record

The current link model is still the right default when the real need is only:

- connect two module-owned entities
- query or traverse that association
- keep the association mutable without hard cross-module foreign-key ownership

Rule:

Use ordinary links by default. Promote to a richer relationship record only
when the relationship itself has product-owned state.

### 4. Generic edge metadata is not the first step

There is a tempting but misleading middle ground where every link gains a
catch-all `metadata` payload.

That usually creates:

- weak ownership
- unclear validation rules
- hard-to-index query behavior
- relationship semantics that drift package by package

Rule:

Do not add framework-wide arbitrary metadata to all links as the first answer
to richer relationship needs.

## Current Runtime Baseline

### 5. Link ownership is neutral; relationship ownership must be explicit

Today's link runtime is intentionally neutral:

- modules expose linkable entities
- the package that stores a cross-package reference declares the neutral link in
  its package-owned `voyant` manifest
- genuinely ownerless standard-product pairs are selected as explicit BOM
  extensions rather than copied into a starter
- generated pivot tables live outside module-owned canonical tables

That neutrality is valuable for simple associations.

But neutrality becomes a problem once the association itself has business
meaning that needs validation, lifecycle rules, or API shape.

Rule:

Keep neutral ownership for pair-only links. Require explicit module ownership
for richer relationship records.

Executable link facets declare both a symbolic package `source` and named
`export`. The selected deployment graph emits those declarations into the
generated link runtime. Starter `src/links` directories are not an authority.

### 6. Existing link tables are not a hidden graph API

The current link system already gives Voyant:

- one-to-one
- one-to-many
- many-to-one
- many-to-many
- read-only externally-owned traversal

That is enough for the current baseline.

Rule:

Do not reinterpret the current link runtime as a general graph-modeling layer.

### 7. Relationship-specific reads may still use links as part of the path

Even when a richer relationship record eventually exists, links may still
participate in:

- traversal
- lookup convenience
- migration compatibility

But the richer business fields should not depend on an arbitrary shared
metadata contract to exist.

Rule:

If a relationship record needs real fields, model those fields explicitly even
if links still participate in the surrounding query path.

## Promotion Threshold For Richer Relationship Records

### 8. Promote only when the relationship itself has real state

Richer relationship records become justified when one or more of these become
true:

- the relationship needs labels, statuses, or configuration that affect product
  behavior
- the relationship needs domain validation beyond "the pair exists"
- the relationship needs lifecycle/history semantics beyond simple link
  timestamps
- querying the relationship requires filtering on relationship-owned fields

Rule:

Promote only when the relationship itself has meaningful state, not just
because richer metadata might be convenient someday.

### 9. The first richer slice must stay family-specific

If Voyant promotes one relationship family into a richer record, the first
slice should be:

- one relationship family
- one explicit owner
- one concrete query/mutation surface
- one documented validation and lifecycle model

Rule:

Do not solve richer relationship records by creating a platform-wide graph-edge
abstraction first.

## Product Guidance

### 10. Modules should prefer local tables when the relationship is really theirs

If one module is clearly the owner of the relationship semantics, the simplest
model is often:

- a local module-owned table
- explicit foreign or external IDs
- explicit API shape
- explicit validation and indexes

That can still coexist with the wider cross-module architecture.

Rule:

When the relationship semantics are clearly owned, prefer a module-owned record
over framework-wide link enrichment.

### 11. Templates may compose links, but they should not invent link semantics

Templates can:

- declare cross-module links
- generate link DDL
- compose modules that traverse those links

They should not become the place where arbitrary relationship metadata rules
are invented ad hoc.

Rule:

Keep relationship semantics in owned runtime/module surfaces, not in
starter-local link conventions.

### 12. Queries should stay honest about what they are reading

A query that reads:

- endpoint-owned state
- relationship-owned state
- linked traversal state

should be clear about which layer owns which field.

Rule:

Do not hide relationship-owned business fields behind what still looks like a
plain pair-link abstraction.

## Practical Checklist

When adding or reviewing a cross-module association in Voyant:

1. If the association is only "A links to B", use the current link model.
2. If the association needs business fields of its own, identify the owner.
3. Model relationship-owned fields explicitly instead of adding arbitrary link
   metadata by default.
4. Keep the first richer relationship slice limited to one family.
5. Do not turn the current link runtime into a graph-style metadata framework.

## Non-Goals

This guide does not introduce:

- arbitrary metadata on every link row
- a platform-wide graph-edge abstraction
- a replacement for the current pair-first link model

The point is disciplined promotion from simple links to owned relationship
records, not a larger relationship framework.
