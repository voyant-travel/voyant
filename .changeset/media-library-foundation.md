---
"@voyant-travel/media": minor
---

Scaffold the `@voyant-travel/media` library foundation: the `media_asset`,
`media_folder`, `media_folder_member`, and `asset_usage` schema, a
transport-agnostic service (content-checksum dedup, list/search, folder CRUD +
membership, usage tracking with a delete-in-use guard), and the media library
admin API routes under `/v1/admin/media-library/*`, all built on
the existing `@voyant-travel/storage` byte seam. Backend/domain foundation only.
