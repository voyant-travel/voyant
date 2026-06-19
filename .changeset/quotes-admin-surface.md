---
"@voyant-travel/quotes": minor
"@voyant-travel/quotes-contracts": minor
"@voyant-travel/quotes-react": minor
"@voyant-travel/i18n": minor
---

Quotes admin surface. A pipeline board (`/quotes`) plus a full quote workspace (`/quotes/$id`): editable deal fields, client (person and/or organization — B2C/B2B), travelers with an explicit PAX count, line items, tags, owner, the activity timeline, and the quote's versions nested inline. The quote value is derived from its line items and recomputed server-side on every change. Saving snapshots the current line items into a new proposal version that supersedes the prior one (one current version at a time); versions show a sequential number, Active/Expired status, and an editable valid-until on the active version. Adds `quotes.paxCount` plus `createdBy`/`updatedBy` audit fields (stamped from the acting user), an owner picker sourced from team members (falling back to the current user), and the `nav.quotes` operator label. All new copy is in en + ro.
