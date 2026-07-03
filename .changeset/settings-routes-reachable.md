---
"@voyant-travel/finance": patch
"@voyant-travel/framework": patch
---

Expose booking tax settings through the finance admin route mount so local starters can reach `/v1/admin/finance/tax-settings` without the bookings detail route capturing the request.
