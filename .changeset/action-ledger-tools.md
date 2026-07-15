---
"@voyant-travel/action-ledger": minor
"@voyant-travel/core": patch
"@voyant-travel/tools": minor
"@voyant-travel/mcp": patch
---

Add the provider-neutral, staff-only action-ledger Tool surface for audit
entries, target timelines, approvals, delegations, and relay inspection. Add
guarded approval request/decision Tools whose capability, risk, and policy are
derived from selected graph actions and whose writes fail closed for missing,
conditional, expired, misassigned, or no-longer-selected authority. Publish
selected graph actions to package Tool context contributions. Reversal remains
inspection-only until a provider-neutral runtime can execute and attest the
underlying domain reversal command.
