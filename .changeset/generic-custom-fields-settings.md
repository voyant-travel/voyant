---
"@voyant-travel/custom-fields": minor
"@voyant-travel/custom-fields-react": minor
"@voyant-travel/core": minor
"@voyant-travel/framework": minor
"@voyant-travel/relationships-contracts": minor
"@voyant-travel/relationships-react": minor
"@voyant-travel/relationships": minor
"@voyant-travel/bookings": patch
"@voyant-travel/quotes": patch
"@voyant-travel/operator-standard": patch
---

Move custom-field definition Settings ownership to the generic custom-fields
package. Selected entity manifests now declare the targets and field types that
the canonical API may accept. The unused Relationships definition API and
Settings surfaces are removed without compatibility adapters.

Target capability declarations now constrain searchable, exportable, and
invoiceable settings end to end, and unsupported flags are stored as false.
