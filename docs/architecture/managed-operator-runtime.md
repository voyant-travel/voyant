# Managed operator runtime

Status: active rule

`@voyant-travel/framework/operator-runtime` is the framework-owned runtime entry
for the standard managed `operator` profile. Voyant Cloud can package this entry
with a serialized profile snapshot and provisioned resources; it must not import
`starters/operator/src/*`, clone a tenant repository, or copy starter glue for
the standard source-free operator path.

The entry loads JSON produced by `defineVoyantProject(...)`, validates it with
the managed profile contract, bridges it through
`toCreateVoyantAppProfileConfig(...)`, builds the standard `createVoyantApp(...)`
operator graph, and exposes a Node server bootstrap through
`createNodeServer(...)`.

Cloud-managed resources are resolved from plain env/secrets declared by
`getVoyantProjectRequirements(...)`: Postgres, Redis-compatible cache inputs,
S3/R2-compatible storage, Voyant Cloud workflow configuration, delivery/search
configuration, and scheduled-origin trust. Storefront, site, blog, and shop apps
remain separate Cloud applications that consume the operator API; they are not
bundled by this runtime entry.

The self-host/demo starter may continue to provide richer deployment-local
modules, admin shell, auth UI, and example routes. Those files are not part of
the standard managed runtime contract unless promoted to a package export and
consumed through `@voyant-travel/framework/operator-runtime`.
