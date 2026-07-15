---
"@voyant-travel/auth": minor
---

Add provider-neutral, staff-only team-management Tools for roster, roles,
invitations, and access lifecycle operations. Sensitive writes require explicit
confirmation and are declared as approval- and ledger-gated graph actions.
The Tools fail closed unless deployment authentication supplies an explicit
acting user; organization-only MCP API keys are not treated as user identity and
remain non-invocable until a delegated-user or service-principal model exists.
