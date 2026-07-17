---
"@voyant-travel/finance": minor
"@voyant-travel/operator-settings": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/admin-app": minor
"@voyant-travel/i18n": minor
---

Add an operator-configurable official FX reference-rate source and a dedicated
Invoicing settings page.

A new finance operator setting `fx.referenceSource` (`ecb` | `bnr`, default
`ecb`) lives on the finance operator-settings row, is normalized on read, exposed
through the finance operator-settings runtime port, and surfaced on the
`/tax-settings` admin GET/PATCH schema.

Finance also gains a `finance.fx-reference.runtime` port plus a typed
`resolveReferenceRate({ base, quote, date })` helper that reads the operator's
configured source and delegates to a host-provided implementation; hosts wire it
to their own FX data source. When no provider is wired, an explicit reference-rate
request throws a typed `FinanceFxReferenceSourceUnavailableError`. No existing
invoice math is wired to it — this ships the setting and seam only, with zero
behaviour change for existing deployments.

Invoicing configuration moves off the Taxes settings page onto a new dedicated
**Invoicing** settings page (registered in the admin settings navigation the same
way Taxes is). The invoicing-mode section moves there and the new reference-rate
Select is added alongside it (EN + RO); both read/write the shared `/tax-settings`
surface. The Taxes page returns to purely tax content.
