---
"@voyant-travel/framework": minor
"@voyant-travel/distribution": patch
---

Add the generated Cloudflare Worker product-job bridge, including fixed trusted
inventory/invocation routes, Worker lifetime handling, terminal health callbacks,
and an explicit Cloudflare-versus-managed schedule projection. Align distribution
recovery with the minimum one-minute hosted scheduler cadence.
