---
"@voyant-travel/notifications": patch
"@voyant-travel/notifications-react": patch
---

Default reminder stages without `maxSendsInStage` to one send so a final stage cannot repeat indefinitely unless a finite repeat cap is configured.

Update the reminder stage editor copy and defaults so blank max-send caps are presented as the one-send default instead of unlimited repeats.
