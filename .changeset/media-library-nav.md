---
"@voyant-travel/media-react": minor
"@voyant-travel/media": minor
"@voyant-travel/i18n": minor
---

Add the Media library admin navigation surface. The media deployment manifest
now declares an `admin` block with a runtime factory, route, and navigation
entry, and `@voyant-travel/media-react/admin` exposes
`createSelectedMediaAdminExtension`, which contributes a "Media library"
navigation item plus a route that renders the `<MediaLibrary>` browse surface.
The operator navigation catalogue gains the `mediaLibrary` label in English and
Romanian.
