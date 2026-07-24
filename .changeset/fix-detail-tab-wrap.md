---
"@voyant-travel/relationships-react": patch
---

Fix the person and organization detail tab bars wrapping awkwardly. With many
tabs, the wrapped row previously stretched its few tabs across the full width
(because tabs default to equal-width). The detail tab bars now keep tabs at
their natural width and left-align the wrapped row.
