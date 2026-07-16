---
"@voyant-travel/bookings": patch
"@voyant-travel/core": minor
"@voyant-travel/custom-fields": minor
"@voyant-travel/custom-fields-react": minor
"@voyant-travel/framework": minor
"@voyant-travel/quotes": patch
"@voyant-travel/relationships": patch
---

Persist custom-field namespace, owner, lifecycle, and provenance metadata.
Operator definitions use the reserved `custom` namespace, app operations are
owner-constrained, platform definitions derive ownership from the selected
target, and Settings renders non-operator definitions as read-only.
