---
"@voyant-travel/relationships": major
---

Restore `create_person` as a handler-owned created-target command whose person,
identity contact points, deterministic `person.changed` outbox event, ledger,
and immutable result commit atomically.

The Tool now always creates a new person and returns
`{ status, person: { id }, replayed }`. It no longer performs implicit
exact-name reuse or accepts `allowDuplicateName`. See
`docs/migrations/created-relationships-person.md` for caller guidance.
