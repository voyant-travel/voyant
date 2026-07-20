---
"@voyant-travel/media-react": patch
---

Media picker polish: widen the picker dialog (`sm:max-w-5xl`, 4-column grid on
large screens) so more assets are visible at once, and render a muted image icon
when a thumbnail fails to load (missing bytes, an undecodable file, or a
security-downgraded content type such as inline SVG) instead of the browser's
broken-image glyph.

The `sm:max-w-5xl` matches the base dialog's `sm:` max-width variant so
tailwind-merge replaces it (a base-variant class like `max-w-3xl` would not).
