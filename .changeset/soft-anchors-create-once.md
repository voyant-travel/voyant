---
"@voyant-travel/action-ledger": minor
"@voyant-travel/bookings": minor
"@voyant-travel/core": minor
"@voyant-travel/distribution": minor
"@voyant-travel/framework": minor
"@voyant-travel/identity": minor
"@voyant-travel/inventory": minor
"@voyant-travel/mcp": minor
"@voyant-travel/tools": minor
---

Make generated-child Tool creation retry-safe by binding each command to an
explicit stable parent anchor, admitting the selected graph action in the
handler, and atomically persisting the command claim, child row, and canonical
child reference.
