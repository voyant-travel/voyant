---
"@voyant-travel/vite-config": patch
---

Reconcile generated route files atomically so concurrent build, test, and architecture checks can
share one workspace without deleting routes while another process scans them.
