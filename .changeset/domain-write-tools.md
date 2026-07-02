---
"@voyant-travel/quotes": minor
"@voyant-travel/finance": minor
"@voyant-travel/notifications": minor
---

Add write/action + notification agent tools:

- `@voyant-travel/quotes`: `accept_quote_version` (write, `quotes:write`,
  confirmation-required).
- `@voyant-travel/finance`: `void_invoice` (destructive, `finance:void`,
  confirmation-required) — the void is a self-contained status transition.
- `@voyant-travel/notifications`: `list_notification_deliveries` +
  `get_notification_delivery` (read, `notifications:read`).

The operator registers them on the in-deployment MCP server. A `send_notification`
tool is deliberately withheld (customer-facing dispatch is an abuse vector and needs
the provider runtime + rate limiting); booking `cancel` / finance `refund` similarly
need route-level runtime wiring and will follow as a separate increment.
