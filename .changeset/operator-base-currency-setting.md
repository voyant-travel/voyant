---
"@voyant-travel/operator-settings": minor
"@voyant-travel/operator-settings-react": minor
"@voyant-travel/finance": minor
"@voyant-travel/i18n": patch
---

Operator base currency setting (the FX recording base).

Add a base-currency selector to Settings → Operator profile. The value is
persisted on the Finance operator-settings singleton (`booking_tax_settings`
gains `base_currency`, `fx_commission_bps`, and `fx_commission_invoice_mention`)
and provided to Finance through the existing operator-settings runtime port, so
`GET`/`PATCH /v1/admin/finance/invoice-fx-settings` can now read and write it.
This is the base every invoice and payment records its `base_*_cents` FX
snapshot against, and the currency reporting consolidates into. Includes the
en/ro catalog copy for the new section.
