---
"@voyant-travel/tools": minor
"@voyant-travel/mcp": minor
"@voyant-travel/action-ledger": minor
"@voyant-travel/bookings": patch
"@voyant-travel/finance": patch
---

Fail closed before selected graph Tool dispatch by binding each capability to its action-ledger
policy. Advertise invocation controls in discovery, enforce confirmation, target, idempotency,
fingerprint, approval, and principal semantics, and record required-ledger execution outcomes.

Keep the existing package-owned booking cancellation and invoice refund approval workflows as
explicit handler-enforced policies so their domain-state fingerprints and atomic ledgers are not
double-gated.
