---
"@voyantjs/availability": patch
---

New `idx_availability_slots_starts_at` on `availability_slots(starts_at)` — backs date-range scans that don't lead with a product/status column (the dashboard aggregates' from..to window).
