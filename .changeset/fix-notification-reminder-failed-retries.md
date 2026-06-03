---
"@voyantjs/notifications": patch
---

Stop stage-based notification reminder sweeps from automatically retrying failed
one-shot reminder runs, and treat queued/skipped/failed reminder runs as attempts
for stage cadence and caps.
