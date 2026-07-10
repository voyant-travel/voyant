# Managed profile runtime

Status: active rule

`@voyant-travel/framework/managed-runtime` is the framework-owned runtime entry
for managed product profiles. It is the source-free boundary: code in this entry
must not import starter-local files, clone a tenant repository, or copy starter
glue.

The entry loads JSON produced by `defineVoyantProject(...)`, validates it with
the managed profile contract, bridges it through
`toCreateVoyantAppProfileConfig(...)`, builds the standard `createVoyantApp(...)`
profile graph, and exposes a Node server bootstrap through
`createNodeServer(...)`.

Cloud-managed resources are declared by `getVoyantProjectRequirements(...)` and
validated before boot. The entry must fail fast when required managed substrate
is missing instead of silently falling back to process-local storage. Local and
self-hosted profiles may still use explicit memory providers for offline/dev
execution.

When a checked deployment graph is available, the generated runtime entry
supplies its deployment mode and complete provider map alongside the resolved
resource requirements. The JSON snapshot remains a compatibility input for
profile/module metadata, but cannot override graph-selected self-hosted
providers.

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
consumed through `@voyant-travel/framework/managed-runtime`.
