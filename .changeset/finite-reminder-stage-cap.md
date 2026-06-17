---
"@voyant-travel/notifications": patch
---

Default reminder stages without `maxSendsInStage` to one send so a final stage cannot repeat indefinitely unless a finite repeat cap is configured.
