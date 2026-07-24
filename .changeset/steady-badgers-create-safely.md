---
"@voyant-travel/core": minor
"@voyant-travel/tools": minor
"@voyant-travel/mcp": minor
"@voyant-travel/framework": minor
"@voyant-travel/action-ledger": minor
"@voyant-travel/bookings": patch
---

Add explicit created-target action metadata and fail closed unless handler-owned
Tools declare a durable command claim, replay, and canonical result-reference
contract. Bind approvals to the pre-create command identity and stop asking MCP
callers to invent generated target IDs.
