# @voyantjs/templating

Liquid/Mustache template rendering and syntax validation, extracted from
`@voyantjs/utils` into a lean package (`liquidjs` only — no Drizzle, no
`@voyantjs/db`, no pdf-lib). This lets contract packages that need template
validation (e.g. `@voyantjs/legal-contracts`, whose contract bodies are Liquid
templates) depend on it without pulling the data layer.

`@voyantjs/utils/template-renderer` re-exports everything here, so existing
import paths are unchanged.
