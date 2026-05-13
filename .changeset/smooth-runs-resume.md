---
"@voyantjs/workflows-orchestrator-cloudflare": patch
"@voyantjs/workflows-orchestrator": patch
---

Add Cloudflare `POST /api/runs/:id/resume` support for starting a new run from a failed parent run with a seeded journal. Resume now carries the metadata replay cursor with the seeded journal, and public trigger requests strip internal resume seed fields.
