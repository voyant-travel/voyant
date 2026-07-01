---
"@voyant-travel/hono": patch
"@voyant-travel/openapi": patch
---

Tag every OpenAPI operation with its module for Swagger/Scalar grouping.

`stampModuleMetadata` now also sets `tags: [module]` on each operation (unless
the route already declares tags). Swagger UI, Scalar, and Redoc key their
sidebar grouping off `tags` and ignore `x-*` extensions, so without this a
whole-surface document (`framework-admin.json`) collapses under a single
"default" group — the browsability pain in voyant#2733. With it, any deployment
can point a viewer straight at a generated spec and get a module-grouped
explorer with no extra work.
