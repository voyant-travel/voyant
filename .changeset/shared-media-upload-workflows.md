---
"@voyantjs/ui": patch
---

Add shared upload-aware media workflows to the product registry components.

`product-media-section` now supports optional file upload handlers and compact
embedded rendering for day-level media management. `product-itinerary-section`
now renders the shared day-media section directly inside expanded itinerary day
rows, so apps no longer need a local wrapper just to manage day media uploads.
