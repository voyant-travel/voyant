---
"@voyant-travel/notifications": patch
---

Resolve and persist email sender addresses before dispatch, and reject email sends when no sender can be resolved so deliveries cannot report `sent` with `fromAddress: null`.
