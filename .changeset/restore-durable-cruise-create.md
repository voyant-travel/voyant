---
"@voyant-travel/cruises": major
---

Restore `create_cruise` as a handler-owned created-target command whose cruise,
required search projection, canonical-cruise-scoped lifecycle outbox event,
ledger, and immutable replay result commit atomically.

This changes the Tool response from the mutable cruise row to
`{ status, cruise: { id }, replayed }`. See
[`docs/migrations/created-target-commerce-charters-cruises.md`](https://github.com/voyant-travel/voyant/blob/main/docs/migrations/created-target-commerce-charters-cruises.md)
for caller migration guidance.
