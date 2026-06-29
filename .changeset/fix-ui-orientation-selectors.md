---
"@voyant-travel/ui": patch
---

Compile UI orientation styles against explicit `data-orientation` selectors so
published starter builds render tabs, sliders, separators, scrollbars, and
toggle groups correctly even when host stylesheets do not register shorthand
orientation variants before scanning package classes.
