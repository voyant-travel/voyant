---
"@voyant-travel/finance-react": patch
---

The invoice detail "Dates & Links" card now shows contextual labels for its
linked records — the booking number, the person's name, and the organization's
name — as the clickable links, instead of a generic "View booking / View
person" action. The names are resolved on demand and fall back to the generic
label only while loading or if a name can't be resolved.
