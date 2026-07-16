---
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/bookings": minor
"@voyant-travel/core": minor
"@voyant-travel/custom-fields": minor
"@voyant-travel/quotes": minor
"@voyant-travel/relationships-contracts": minor
"@voyant-travel/relationships": minor
---

Store custom-field values exclusively as `custom_fields[namespace][key]`.
Owner-scoped value operations derive namespaces from trusted definition
context, ordinary entity routes preserve non-operator namespaces, and
definition rename/delete cleanup is delegated to the package that owns each
entity table.
