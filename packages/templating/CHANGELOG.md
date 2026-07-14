# @voyant-travel/templating

## 0.104.2

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.

## 0.104.1

## 0.104.0

## 0.103.0

## 0.102.0

## 0.101.2

## 0.101.1

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

### Minor Changes

- 485da95: Extract `@voyant-travel/templating` and purify `@voyant-travel/legal-contracts`.

  `@voyant-travel/templating` is a new lean package (`liquidjs` only) holding the
  Liquid/Mustache template renderer and syntax validator, moved out of
  `@voyant-travel/utils`. `@voyant-travel/utils/template-renderer` re-exports it, so existing
  import paths (finance, products, legal runtime) are unchanged.

  `@voyant-travel/legal-contracts` now depends on `@voyant-travel/templating` instead of
  `@voyant-travel/utils` for its contract-body Liquid-syntax validation — dropping the
  transitive Drizzle / `@voyant-travel/db` / pdf-lib dependency. Its tree is now just
  `zod` + `@voyant-travel/schema-kit` + `@voyant-travel/templating` (no data layer).
