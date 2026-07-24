---
"@voyant-travel/core": minor
"@voyant-travel/framework": minor
"@voyant-travel/mcp": minor
"@voyant-travel/trips": minor
---

Add fail-closed graph availability and tested-durability metadata for execute Tool actions.
Unavailable actions remain diagnosable in resolved graph metadata while their Tool runtime is
excluded from action-ledger and MCP lowering. Reclassify Trips pricing as a write and keep it
unavailable until its provider and persistence stages gain tested durable orchestration.
