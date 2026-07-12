# Standard Node Starter Acceptance

The standard Node starter is a generated consumer project, not a copy of the
Operator development application. `scripts/package-starters.mjs` is the single
generator. `scripts/check-standard-node-starter.mjs` packages and inspects its
actual output so generator changes cannot bypass the acceptance gate.

A fresh starter has exactly four authored files:

```text
.env.example
package.json
voyant.config.ts
src/scripts/seed.ts
```

The generator also creates empty, optional project-convention directories for
admin and public APIs, admin UI, modules, workflows, jobs, subscribers, and
links. The seed entry is the only initial project source file.

The gate requires:

- `voyant.config.ts` contains only the Node deployment target and database
  provider choice; it contains no standard modules, extensions, or plugins.
- `package.json` delegates startup to the generic `voyant-operator start`
  bootstrap and names only the CLI, framework, and Operator runtime as Voyant
  dependencies.
- no package-owned OpenAPI documents, migrations, links, subscribers, jobs,
  workflows, admin entries, or API routes are copied into the project.
- no first-party package identifier appears in authored project source.
- the four-file authored-tree ratchet is exact. New initial files require an
  intentional architecture decision and checker update.

The product BOM still expands into an explicit `.voyant/` graph during build.
The source-level gate does not replace runtime acceptance or performance
evidence. Release confidence additionally requires the packaged starter to
install, emit its graph, boot the Node host, exercise local convention files,
and record boot time, server bundle size, and admin chunking in CI.
