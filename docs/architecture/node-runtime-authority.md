# Generic Node Runtime Authority

Voyant application graphs execute in a resident Node process. The public boot
boundary is `@voyant-travel/framework/node-runtime`; generated project and
deployment artifacts provide its admitted `VoyantGraphRuntime`, deployment
mode/providers, deployment requirements, and runtime-port implementations.

`packages/operator-runtime` is a generic generated-project host. It may verify
the generated graph hash and serve the packaged admin application, but it must
not reconstruct `voyant.managed-profile.v1`, select an Operator profile, or
infer package/runtime membership outside the generated graph.

The Node runtime owns process environment adaptation, deployment-resource
assembly, graph value resolution, runtime composition, route posture, and the
resident HTTP server. Product provider defaults, route factories, and service
assembly belong to selected package graph runtimes and typed host ports. Its
deployment contract intentionally has no edge/Workers target:
unified Voyant applications remain Node-only, while independently deployed
storefront and federated surfaces keep their existing target-specific hosts.

## Product Authority Ratchet

Commerce checkout and booking maintenance, Catalog search/booking/offers,
Finance booking schedules, Legal contract documents, and Storage media routes
are composed from their package-owned graph factories. Their deployment
behavior enters through the typed ports declared by those packages; none of
their compatibility route loaders or provider defaults belongs in
`ManagedProfileProviders`.

Graph-selected MCP tools follow the same rule. Tool packages export context
contributors from their declared tool runtime entry. The generic MCP host gives
those contributors the request context and deployment runtime-port resources;
it does not import Catalog or Finance services to construct product contexts.

The remaining selected-group reference in `node-runtime.ts` is
`@voyant-travel/finance/order-payment-sessions`, used only by the legacy Flights
route loader. That residual is outside this extraction and must disappear when
Flights compatibility assembly moves behind its typed runtime port.

## Compatibility Boundary

`@voyant-travel/framework/managed-runtime`, `managed-jobs`, and the
`profile`/`profile-types` contract remain temporarily published for existing
snapshot-generated deployments and Cloud callers. New generated application
artifacts must not depend on those entries. The v1 deployment-artifact manifest
still carries its `profileSnapshot` field so older readers remain compatible,
but the generated Node entry does not read that snapshot to boot.

`scripts/check-node-runtime-authority.mjs` enforces the public subpath, direct
graph boot in generated entries, and the absence of managed-profile synthesis
from `packages/operator-runtime`.
`scripts/check-node-runtime-product-authority.mjs` separately caps first-party
references at 44, forbids the extracted provider fields, verifies package
runtime authority, and permits only the documented Finance/Flights residual.
