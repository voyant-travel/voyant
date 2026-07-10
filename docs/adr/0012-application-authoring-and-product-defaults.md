# ADR-0012: Application authoring and product defaults

- **Status:** Accepted (2026-07-11)
- **Relates to:** [ADR-0007](./0007-module-subsetting-and-capability-ports.md),
  [ADR-0008](./0008-convention-driven-deployment-surface.md),
  [unified deployment graph](../architecture/unified-deployment-graph.md),
  [module/provider/extension/plugin taxonomy](../architecture/module-provider-plugin-taxonomy.md)

## Context

The unified deployment graph made package-owned facets inspectable and
deterministic, but the first source-backed operator exposed the resolved graph
as its authored configuration. A new application repeated the standard module
closure and package-owned extensions, classified extensions as plugins, and
kept parallel starter registries for local routes, workflows, subscribers, and
jobs.

That surface is accurate as generated deployment data but too shallow as an
application interface. Standard product knowledge belongs to the product
distribution, not every consumer project.

## Decision

**Authored configuration expresses differences from the standard Operator;
the generated graph expresses the complete deployment.**

1. The framework-owned Operator distribution supplies the standard module and
   package-owned extension closure. A normal project does not repeat it.
2. `plugins` contains reusable distribution packages installed by the
   application. Package-owned extensions are extension contributions, not
   plugins.
3. Application-local contributions are discovered at build time from
   conventional directories:
   `src/api/{admin,store}`, `src/admin`, `src/workflows`, `src/jobs`,
   `src/subscribers`, `src/links`, and `src/modules`.
4. Discovery is deterministic and Node-only. It produces normalized stable IDs,
   validates collisions and requirements, and writes the complete result under
   disposable `.voyant/` output before runtime code is loaded.
5. Reusable custom modules and external plugins remain explicit authored
   selections. Local conventional API routes, workflows, jobs, subscribers,
   links, and admin contributions do not require duplicate config entries.
6. Standard defaults may change only through a dependency or lockfile change.
   `voyant upgrade`, graph diffing, and `voyant doctor` must report the
   resulting facet, migration, provider, access, schedule, and resource changes.
7. Route and stable-ID collisions fail by default. Replacing standard behavior
   requires a separately named explicit override contract; file order never
   decides precedence.
8. The public configuration helper is `defineConfig`. Authored definitions and
   resolved manifests are separate types; placeholder manifests are not part of
   the public application interface.

The initial standard Operator remains the only composed application runtime and
always lowers to Node. This decision does not create a managed-operator variant
or an edge deployment target.

## Consequences

- A new project starts with an almost-empty `voyant.config.ts` and empty
  extension directories while retaining the complete standard Operator.
- Adding a conventional local file intentionally changes the generated graph,
  and the graph remains inspectable, hashable, and reviewable.
- Packages own standard extensions once. Consumer applications configure only
  external plugins, custom modules, provider choices, and deliberate overrides.
- The operator starter can delete manual composition maps as each conventional
  contribution is generated.
- ADR-0007 default-on compatibility remains an internal migration bridge, not
  the application authoring interface.
- ADR-0008 convention discovery applies to application-local contributions and
  package-owned facets at build time; Workers are not a composed deployment
  target.

## Alternatives considered

- **Scaffold every standard graph selection into each project.** Rejected
  because it makes framework-owned wiring look application-owned and creates
  noisy, stale configuration.
- **Commit the resolved graph.** Rejected because the package lockfile and source
  definition are authoritative; `.voyant/` is reproducible build output.
- **Treat every extension as a plugin.** Rejected because plugin is a
  distribution concept, while extension is runtime behavior owned by a module
  or plugin bundle.
- **Runtime directory scanning.** Rejected because deployment planning,
  admission, migrations, OpenAPI, and Node bundling require static build-time
  composition.
