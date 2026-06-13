---
"@voyantjs/workflows-orchestrator": patch
---

Keep the in-memory workflow driver from dropping a chained DATETIME wakeup when a timer callback fires before the stored wake time is due.
