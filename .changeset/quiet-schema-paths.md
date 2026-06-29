---
"@voyant-travel/framework-migrations": patch
---

Fix migration source discovery for schema manifests that contain `file://` URLs, so published starters resolve package-owned `migrations/` folders from installed `@voyant-travel` packages.
