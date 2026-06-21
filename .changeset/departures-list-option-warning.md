---
"@voyant-travel/operations-react": minor
"@voyant-travel/i18n": patch
---

Surface a missing-option warning in the departures (availability slots) list (#2062).

The slots table now has an Option column that shows each departure's option name
and flags — with an amber badge + tooltip — any slot that has no option on a
product that actually has options (i.e. an unpriceable departure that should be
repaired via the option picker). Products without options are not flagged. The
column resolves names from one capped active-options query per visible product,
so a missing linkage is discoverable from the list, not just inside the edit
dialog.
