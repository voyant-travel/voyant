---
"@voyant-travel/media": minor
"@voyant-travel/operator-standard": minor
---

Mount the media-library admin surface into the standard operator distribution.
The media package now ships a deployment manifest and graph runtime factory that
resolve the `"media"` object-storage provider through the storage runtime port
and inject it into the media-library routes, and the standard operator
distribution selects the module so `/v1/admin/media-library/*` is served.
