---
"@voyantjs/workflows": minor
"@voyantjs/workflows-ui": minor
"@voyantjs/workflows-react": patch
---

Consolidate the public workflows package surface around `@voyantjs/workflows`
subpaths and `@voyantjs/workflows-ui`.

Use `@voyantjs/workflows/errors`, `@voyantjs/workflows/config`, and
`@voyantjs/workflows/bindings` instead of the former one-file packages. Use
`@voyantjs/workflows-ui` instead of `@voyantjs/workflow-runs-ui`.
