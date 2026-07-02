---
"@voyant-travel/bookings": minor
"@voyant-travel/finance": minor
"@voyant-travel/quotes": minor
"@voyant-travel/relationships": minor
---

Add read-only agent tools (`./tools`) for four more domains, following the
module-owned-tools pattern over each package's existing service:

- `@voyant-travel/bookings`: `list_bookings` + `get_booking` (non-PII, `bookings:read`).
- `@voyant-travel/finance`: `list_invoices` + `get_invoice` (`finance:read`).
- `@voyant-travel/quotes`: `list_quotes` + `get_quote` (`quotes:read`).
- `@voyant-travel/relationships`: `list_people` / `get_person` / `list_organizations` /
  `get_organization` (`crm:read`).

The operator registers them on the in-deployment MCP server, so `/v1/admin/mcp` now
serves trips, products, bookings, finance, quotes, and CRM tools, each gated per-tool
by scope + audience.
