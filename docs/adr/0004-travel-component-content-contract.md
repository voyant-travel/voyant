# ADR-0004: Shared travel component content contract

- **Status:** Accepted (2026-06-02)
- **Relates to:** [#1470](https://github.com/voyantjs/voyant/issues/1470), [#1469](https://github.com/voyantjs/voyant/issues/1469)

## Context

Composite travel sellables appear across products, sourced wholesaler packages,
cruises, charters, accommodations, and composed trips. The recurring shape is a
stable customer-facing component: accommodation, transport, activity, meal,
insurance, or another included/add-on part.

The current codebase has the pricing and runtime composition pieces:

- operated product/package pricing uses `@voyantjs/pricing`;
- sourced inventory resolves volatile price/availability through source
  adapters;
- runtime trip composition lives in `@voyantjs/travel-composer`.

The missing piece is a pure, reusable content/configuration vocabulary for
component structure. Without it, package components flatten into titles,
descriptions, or vertical-specific payloads.

## Decision

Create **`@voyantjs/travel-components-contracts`** as a pure contracts package
for cross-vertical travel component content.

The package owns:

- `boardBasis` enum;
- component kind, selection mode, commitment boundary, and price disposition
  enums;
- `componentRef` shape for first-class entity references;
- shared component content schemas for accommodation, transport, and generic
  components;
- `travelComponent` schemas and validators.

The package is zod-only. It does not depend on runtime packages and does not
define Drizzle tables, routes, services, booking handlers, or live resolver
behavior.

Vertical contract packages may import these schemas into their own
`<vertical>/v1` content aggregates. Runtime packages continue to depend on their
contract packages, preserving the ADR-0002 dependency direction.

## Rules

Use `ref` when the component has first-class Voyant identity, independent
content governance, reuse across parents, or its own commitment lifecycle.

Use `inline` when the component exists only inside the parent sellable or is
stable display/configuration data that should snapshot with the parent.

Content carries stable browse/detail/snapshot fields. Current price, remaining
availability, hold tokens, and date-sensitive cancellation penalties resolve
through `@voyantjs/pricing`, owned booking handlers, or source-adapter
`liveResolve`.

`commitmentBoundary` controls booking routing:

- `internal` stays inside one package/product booking;
- `dependent_component` nests as an Extra/add-on;
- `independent_component` becomes a sibling Component Booking / Order under a
  Trip / Package Envelope.

## Consequences

### Positive

- Products, cruises, charters, accommodations, source adapters, catalog UI, and
  storefronts can speak the same component content vocabulary.
- Adapter authors can validate package component payloads without installing
  runtime packages.
- Board basis becomes a canonical shared enum rather than a string convention in
  one vertical.
- The contract supports sourced and operated inventory without forcing sourced
  packages into `products`.

### Negative

- Adds another package to the workspace graph.
- The package can become too broad if vertical-specific operational fields are
  moved into it too early.

### Mitigations

- Keep the package limited to pure, cross-vertical travel component payloads.
- Keep operational schemas, pricing tables, and booking behavior in the owning
  runtime packages.
- Move fields back into vertical contracts when only one vertical needs them.

## Alternatives considered

### Put component contracts in `@voyantjs/catalog-contracts`

Rejected. `catalog-contracts` owns the catalog plane: adapter contracts,
provenance, field policy, snapshots, and booking-engine contracts. Travel
component content is domain vocabulary used by several vertical content shapes;
putting it in catalog would make the catalog contract a dumping ground.

### Put component contracts in `@voyantjs/products-contracts`

Rejected. Products are only one consumer. Cruises, charters, accommodations, and
sourced inventory need the same board basis and component vocabulary.

### Add a package-specific runtime price matrix

Rejected. Operated package pricing already has `@voyantjs/pricing`; sourced
package pricing resolves through adapters. Matrix authoring/import can write the
existing pricing tables without adding a second runtime source of truth.
