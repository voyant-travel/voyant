# Domain Docs

Agents should use Voyant's domain vocabulary and architecture decisions before
making implementation suggestions.

Read first:

- `UBIQUITOUS_LANGUAGE.md`
- `docs/adr/0001-tenant-scoping.md`
- relevant files under `docs/architecture/`
- `docs/frontend-package-strategy.md` for UI/public package work

Key architecture docs:

- `docs/architecture/schema-discipline.md`
- `docs/architecture/api-route-authoring.md`
- `docs/architecture/module-provider-plugin-taxonomy.md`
- `docs/architecture/data-model-schema-authoring.md`
- `docs/architecture/event-delivery-and-durable-execution-policy.md`

Use canonical domain terms in issue titles, briefs, tests, and PR summaries.
If a needed concept is missing or ambiguous, flag it rather than inventing a
new term silently.
