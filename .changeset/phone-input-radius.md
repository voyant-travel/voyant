---
"@voyant-travel/ui": patch
---

Match the phone input's border radius to the other form controls. The composed
`PhoneInput` hard-coded `rounded-lg` on its outer corners (the country-select
button and the number field), so it looked rounder than the sibling inputs,
selects and buttons, which all use `rounded-sm`. Align both outer corners to
`rounded-sm`.
