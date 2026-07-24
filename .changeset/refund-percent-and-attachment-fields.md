---
"@voyant-travel/legal-react": patch
"@voyant-travel/finance-react": patch
---

Simplify two admin forms for non-technical users. The cancellation-policy
refund field now takes a plain percentage (0–100) instead of basis points
(the value is still stored as basis points under the hood). The invoice
attachment dialog no longer asks users to type system-derived metadata (MIME
type, file size, checksum) — those fields are removed from the form.
