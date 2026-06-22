---
"@voyant-travel/trips": minor
---

Add admin HTTP routes + zod schemas for the dynamic-packaging requirement/candidate operations (voyant#2082): `POST`/`GET /:envelopeId/requirements`, `POST /requirements/:id/candidates` (source ranked candidates), `POST /requirements/:id/select`, `POST /requirements/:id/reshop`, and `POST /:envelopeId/reshop`. The availability fan-out is injected via `TripsRoutesOptions.sourceCandidatesDeps` (the deployment wires its adapters/owned handlers) — routes return 501 until configured and 403 on the public surface.
