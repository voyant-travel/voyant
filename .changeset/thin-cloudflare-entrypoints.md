---
"@voyantjs/promotions": patch
---

Add a lightweight `@voyantjs/promotions/workflow-runtime` export for workflow host constants and service contracts, allowing Cloudflare Worker entrypoints to avoid importing the full promotions module graph at startup.
