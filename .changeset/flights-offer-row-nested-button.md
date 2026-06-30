---
"@voyant-travel/flights-react": patch
---

Render the flight offer row as a non-button container so the inner "Select" button no longer nests inside a button, fixing invalid-HTML hydration warnings while preserving click and keyboard selection.
