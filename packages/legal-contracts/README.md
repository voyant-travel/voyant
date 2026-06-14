# @voyant-travel/legal-contracts

Pure legal validation schemas and enums (contracts + policies) for consumers
(the Admin SDK, Voyant Connect) that validate legal payloads without the legal
runtime (Drizzle schema, Hono routes, services).

`@voyant-travel/legal` re-exports these from `./contracts/validation` and
`./policies/validation`, so existing import paths are unchanged.

> Contract bodies are Liquid templates, so `contracts/validation` validates
> their syntax via `@voyant-travel/templating` (a lean, `liquidjs`-only package). This
> package depends on `zod` + `@voyant-travel/schema-kit` + `@voyant-travel/templating` — no
> data layer (Drizzle / `@voyant-travel/db`) in the dependency tree.
