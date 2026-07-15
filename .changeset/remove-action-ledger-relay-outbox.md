---
"@voyant-travel/action-ledger": minor
"@voyant-travel/action-ledger-react": minor
"@voyant-travel/i18n": patch
"@voyant-travel/schema-kit": patch
---

Remove the unused action-ledger relay outbox schema, service, HTTP route, tool,
and entry-detail UI. Ledger canaries now verify the append-only write path, and
future exports/projections use cursor checkpoints while work-queue consumers use
the framework's generic durable event outbox.
