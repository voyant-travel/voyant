---
"@voyant-travel/vite-config": patch
---

Preserve module execution order across explicit Vite 8 vendor chunks so portable admin-shell documents cannot observe uninitialized circular imports.
