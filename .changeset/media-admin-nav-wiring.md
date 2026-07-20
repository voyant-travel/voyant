---
"@voyant-travel/media-react": minor
"@voyant-travel/media": minor
"@voyant-travel/i18n": minor
---

Wire the media library into the graph-composed admin surface. The media package
now declares an `admin.runtime` factory in its deployment manifest, and
`@voyant-travel/media-react/admin` exposes `createSelectedMediaAdminExtension`,
which contributes a "Media library" navigation item and a route that renders the
`<MediaLibrary>` browse surface. The operator navigation catalogue gains the
`mediaLibrary` label in English and Romanian.
