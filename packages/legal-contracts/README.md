# @voyantjs/legal-contracts

Pure legal validation schemas and enums (contracts + policies) for consumers
(the Admin SDK, Voyant Connect) that validate legal payloads without the legal
runtime (Drizzle schema, Hono routes, services).

`@voyantjs/legal` re-exports these from `./contracts/validation` and
`./policies/validation`, so existing import paths are unchanged.

> Note: `contracts/validation` pulls `validateStructuredTemplateSyntax` from
> `@voyantjs/utils`, so this package isn't strictly zod-only yet (it transitively
> depends on `@voyantjs/utils`). Extracting that template-syntax validator into a
> pure home (e.g. `@voyantjs/schema-kit`) is a follow-up that would make
> `legal-contracts` fully zod-only.
