---
"@voyant-travel/operations-react": minor
"@voyant-travel/i18n": patch
---

Add an option picker to the admin departure (availability slot) form (#2059).

The slot create/edit dialog now lets an operator choose which of the product's
active options a departure belongs to — populated from the product's options
(default marked), required when the product has options, and pre-selected from
the slot's current `optionId` on edit so an unpriceable/incorrect slot can be
repaired through the UI. Selecting a different product clears the stale option.
This complements the pricing-correctness fixes in #2058: a departure's price is
derived from its option's rate plans, so a slot must point at an option.
