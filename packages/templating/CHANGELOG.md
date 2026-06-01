# @voyantjs/templating

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

### Minor Changes

- 485da95: Extract `@voyantjs/templating` and purify `@voyantjs/legal-contracts`.

  `@voyantjs/templating` is a new lean package (`liquidjs` only) holding the
  Liquid/Mustache template renderer and syntax validator, moved out of
  `@voyantjs/utils`. `@voyantjs/utils/template-renderer` re-exports it, so existing
  import paths (finance, products, legal runtime) are unchanged.

  `@voyantjs/legal-contracts` now depends on `@voyantjs/templating` instead of
  `@voyantjs/utils` for its contract-body Liquid-syntax validation — dropping the
  transitive Drizzle / `@voyantjs/db` / pdf-lib dependency. Its tree is now just
  `zod` + `@voyantjs/schema-kit` + `@voyantjs/templating` (no data layer).
