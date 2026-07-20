---
"@voyant-travel/media": patch
"@voyant-travel/media-react": patch
---

Media library polish:

- Rename the admin route from `/media-library` to `/media` (nav + default host base path).
- Move folder creation from an inline sidebar form into a dialog.
- Give uploaded objects a file extension in their storage key so the byte-serving route (which sends `X-Content-Type-Options: nosniff`) infers the correct `Content-Type` — raster images and PDFs now render instead of downloading as `application/octet-stream`.
