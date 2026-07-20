---
"@voyant-travel/inventory-react": minor
---

Route inline product-media uploads through the Media Library. Uploading a file
from the product media section or an itinerary day now creates a library asset
(so it appears in the Media Library) and attaches it to the product via
`assetId`, mirroring the byte-URL convention used by library-picked assets. The
host-provided `uploadMedia` storage handler stays supported as an optional
legacy fallback.
