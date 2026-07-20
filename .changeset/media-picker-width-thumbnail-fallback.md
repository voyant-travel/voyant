---
"@voyant-travel/media-react": patch
---

Media picker polish: widen the picker dialog (`sm:!max-w-5xl`, 4-column grid on
large screens) so more assets are visible at once, and render a muted image icon
when a thumbnail fails to load (missing bytes, an undecodable file, or a
security-downgraded content type such as inline SVG) instead of the browser's
broken-image glyph.
