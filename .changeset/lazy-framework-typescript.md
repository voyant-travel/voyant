---
"@voyant-travel/framework": patch
---

Load TypeScript only when project convention source is analyzed so production
runtime imports do not require the compiler to be installed.
