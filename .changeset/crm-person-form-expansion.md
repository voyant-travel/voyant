---
"@voyantjs/crm": patch
"@voyantjs/crm-react": patch
"@voyantjs/crm-ui": patch
---

Expand the CRM person form and detail surface.

- `PersonForm` gains addresses and relationships subforms with full add/remove/edit affordances; `OrganizationForm` picks up the same address widgets.
- New exported sections `PersonAddressesSection` and `PersonRelationshipsSection` so the person detail page can render addresses/relationships outside the edit form (e.g. on the read-only detail view).
- i18n strings for the new sections (EN + RO).
- `@voyantjs/crm` service/validation: rename the legacy `birthday` field to `dateOfBirth` to match the rest of identity; migrations `0028_rename_birthday.sql` (dev), `0010_rename_birthday.sql` (dmc), and `0018_rename_birthday.sql` (operator) handle the column rename.
- Document-attach service tightens its validation around the renamed field.
