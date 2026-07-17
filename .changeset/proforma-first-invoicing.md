---
"@voyant-travel/finance": minor
"@voyant-travel/operator-settings": minor
---

Add proforma-first invoicing as standard finance behaviour. A new operator
setting `invoicing.mode` (`direct` | `proforma-first`, default `direct`) lives on
the finance operator-settings row and is exposed through the finance
operator-settings runtime port. In `proforma-first` mode the finance
proforma-conversion subscriber automatically mints the fiscal invoice from a
proforma once it is fully settled (`invoice.settled` / `invoice.payment.recorded`),
copying lines, assigning the fiscal number, linking both documents, and voiding
the proforma. The admin invoices list shows a proforma kind badge and the tax
settings page exposes the invoicing-mode toggle. Fiscal-provider sync stays in
plugins. `direct` mode is unchanged — zero behaviour change for existing
deployments.
