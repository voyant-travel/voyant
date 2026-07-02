---
"@voyant-travel/inventory": minor
---

Add read-only agent tools for the products domain at
`@voyant-travel/inventory/tools`: `list_products` and `get_product`, exposed as
headless `defineTool`s over the existing products service (`products:read` scope,
read tier). The operator registers them on the in-deployment MCP server alongside
the trips tools — establishing the module-owned-tools pattern for the remaining
domains.
