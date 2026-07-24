---
"@voyant-travel/trips": patch
"@voyant-travel/relationships": minor
"@voyant-travel/quotes": patch
"@voyant-travel/legal": patch
"@voyant-travel/storefront": patch
---

Anchor generated-child actions to stable existing parents so action policy checks
do not require IDs that only exist after dispatch. Split relationship child
creation Tools by person and organization so each selected action has one
unambiguous parent target type. Bind each generic action's policy target to its
domain parent-id input before ledger, approval, or handler execution.
