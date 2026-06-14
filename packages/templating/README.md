# @voyant-travel/templating

Liquid/Mustache template rendering and syntax validation, extracted from
`@voyant-travel/utils` into a lean package (`liquidjs` only — no Drizzle, no
`@voyant-travel/db`, no pdf-lib). This lets contract packages that need template
validation (e.g. `@voyant-travel/legal-contracts`, whose contract bodies are Liquid
templates) depend on it without pulling the data layer.

`@voyant-travel/utils/template-renderer` re-exports everything here, so existing
import paths are unchanged.
