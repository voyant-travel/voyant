# Managed profile runtime

Status: compatibility rule

> Compatibility status: this entry remains supported for persisted profile
> snapshots. New generated applications boot through the graph-native
> [`node-runtime` authority](./node-runtime-authority.md).

`@voyant-travel/framework/managed-runtime` is the compatibility runtime entry
for managed product profiles. It re-exports the source-free Node implementation;
runtime code must not import starter-local files, clone a tenant repository, or
copy starter glue.

The entry accepts an admitted project manifest or a compatibility JSON snapshot,
then composes package runtime factories from the selected deployment graph. It
uses `createVoyantApp({ standard: false })` only as the final Hono assembly layer
and exposes the result through `createNodeServer(...)`. The legacy
`createVoyantApp` standard-registry mode must fail when a selected standard unit
has no registry factory; it must never silently omit graph-owned routes.

Cloud-managed resources are declared by `getVoyantProjectRequirements(...)` and
validated before boot. The entry must fail fast when required managed substrate
is missing instead of silently falling back to process-local storage. Local and
self-hosted profiles may still use explicit memory providers for offline/dev
execution.

The generated runtime entry supplies its deployment mode and complete provider
map alongside the resolved resource requirements. A generic Node host passes
those graph-native inputs directly and does not construct a managed-profile
manifest. The JSON snapshot remains a compatibility input for older callers
and cannot override graph-selected self-hosted providers.

The source-free managed runtime is not yet a complete managed Cloud image by
itself. Redis-backed `CACHE`/`RATE_LIMIT` bindings, Voyant Cloud admin auth
broker integration, snapshot plugin resolution, and route families still backed
by starter-local loaders must be promoted to package/framework-owned exports
before the corresponding managed Cloud surfaces can be enabled. Until then, the
managed Cloud profile bridge excludes those starter-local surfaces and rejects
explicit attempts to include them.

Storefront, site, blog, and shop apps remain separate Cloud applications that
consume the managed API for the profile; they are not bundled by this runtime
entry.

The self-host/demo starter may continue to provide richer deployment-local
modules, admin shell, auth UI, and example routes. Those files are not part of
the standard managed runtime contract unless promoted to a package export and
consumed through `@voyant-travel/framework/node-runtime`.
