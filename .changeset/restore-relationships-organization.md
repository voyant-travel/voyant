---
"@voyant-travel/relationships": major
---

Restore `create_organization` as a handler-owned created-target command whose
organization, optional billing address, deterministic `organization.changed`
outbox event, ledger, and immutable result commit atomically.

The Tool now returns `{ status, organization: { id }, replayed }` instead of
the mutable organization and billing-address rows. See
`docs/migrations/created-relationships-organization.md` for caller guidance.
