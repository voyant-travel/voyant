# Generic Node Runtime Authority

Voyant application graphs execute in a resident Node process. The public boot
boundary is `@voyant-travel/framework/node-runtime`; generated project and
deployment artifacts provide its admitted `VoyantGraphRuntime`, deployment
mode/providers, deployment requirements, and runtime-port implementations.

`packages/operator-runtime` is a generic generated-project host. It verifies
the generated graph hash and serves the packaged admin application without
reconstructing a snapshot-era project contract or inferring package/runtime
membership outside the generated graph.

The Node runtime owns process environment adaptation, deployment-resource
assembly, graph value resolution, runtime composition, route posture, and the
resident HTTP server. Product provider defaults, route factories, and service
assembly belong to selected package graph runtimes and typed host ports. Its
deployment contract intentionally has no edge/Workers target:
unified Voyant applications remain Node-only, while independently deployed
storefront and federated surfaces keep their existing target-specific hosts.

## Product Authority

Accommodations, Bookings, Catalog, Commerce, Finance, Flights, Inventory,
Legal, Notifications, Quotes, Relationships, Storage, Storefront, and Trips are
composed from package-owned graph factories. Their deployment behavior enters
through typed ports declared by those packages. The Node host exposes only a
generic resource record for deployment-local factories and a generic runtime
port record for selected package factories; it has no product-shaped provider
container, compatibility route loaders, or product provider defaults.

Graph-selected tools follow the same rule. Tool packages export context
contributors from their declared tool runtime entries, and the MCP host supplies
request context and deployment runtime-port resources without the Node runtime
importing product services or assembling product tool contexts.

## Compatibility Boundary

`@voyant-travel/framework/managed-runtime`, `managed-jobs`, `profile`, and
`managed-profile-compatibility` remain temporarily published for existing
external snapshot-generated deployments and Cloud callers. They are deprecated
and may not be imported by generated applications or graph-native framework
modules.

The v1 deployment-artifact manifest and generated Node entry no longer carry a
profile snapshot path. A runtime entry has `kind: "node"` and boots from its
admitted graph runtime, deployment settings, and graph-derived requirements.
Generic admin hosting uses `serveAdminHost` and `createAdminSsrHandler`; the old
names exist only on the admin-host compatibility subpath.

`scripts/check-node-runtime-authority.mjs` enforces the public subpath, direct
graph boot in generated entries, and the absence of managed-profile synthesis
from `packages/operator-runtime`.
`scripts/check-node-runtime-product-authority.mjs` separately requires zero
first-party product imports, exact and justified infrastructure import
exceptions, absence of the retired product provider surface, and package-owned
runtime authority for the selected product set.
`scripts/check-profile-compatibility-boundary.mjs` enforces the snapshot
compatibility retirement boundary.
