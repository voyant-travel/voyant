---
"@voyantjs/finance": patch
---

Index pass for the hot finance read paths: `supplier_invoices` hot list/filter indexes (`supplier_id`, `(supplier_id, created_at)`, `status`, `(status, created_at)`, `due_date`) are now partial on `deleted_at IS NULL` — every supplier-invoice read path filters soft-deleted rows, so the indexes shrink and stay usable for all of those queries (same index names, definition change only). New `idx_invoices_created` on `invoices(created_at)` backs the dashboard's monthly rollups, which filter a bare `created_at` range.
