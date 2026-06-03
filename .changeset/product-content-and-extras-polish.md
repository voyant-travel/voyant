---
"@voyantjs/products-ui": minor
"@voyantjs/i18n": minor
---

Follow-up polish for the operator product detail, from client review:

- **Inclusions / exclusions / terms are now editable in the product sheet — and localizable.** The whole stack already carried `inclusionsHtml`/`exclusionsHtml`/`termsHtml` (product + `product_translations` columns, validation, react schemas, services); the form just never exposed them, so clients forked their own UI. They're now three rich-text `TranslatableField`s that switch with the language switcher and persist to the base columns + per-language translation rows.
- **Traveler-type columns are editable/removable.** Hovering an Adult / Child column header reveals edit (opens the category dialog pre-filled) and remove (deletes a product/option-owned category, or just drops its prices for a shared global one). `TravelerCategoryDialog` is now edit-capable.
- **Extras define + price in one place.** The standalone product-level "Extra" card is removed; each booking option's pricing has a single Extras section that both defines (new reusable `ProductExtraDialog`) and prices each add-on (per the option's rate plan), with edit/delete.
