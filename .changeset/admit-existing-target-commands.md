---
"@voyant-travel/action-ledger": minor
"@voyant-travel/bookings": patch
"@voyant-travel/core": minor
"@voyant-travel/finance": patch
"@voyant-travel/framework": patch
"@voyant-travel/mcp": patch
"@voyant-travel/tools": minor
---

Add an explicit handler-owned durable result protocol for existing-target Tool
commands, including atomic package-owned operation intent preparation, exact
admission, stable replay context, organization-bound approval continuity, and
framework/runtime contract validation. Existing-target command payloads are
restricted to immutable, acyclic JSON values so their runtime identity cannot
diverge from canonical fingerprinting; that sanitized frozen value is the
authoritative target, fingerprint, claim, and handler snapshot.
