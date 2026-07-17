---
"@voyant-travel/commerce": minor
"@voyant-travel/finance": minor
---

Wire checkout finalization to the operator invoicing mode. When an operator runs `proforma-first`, a fresh checkout now issues a proforma instead of a fiscal invoice; the fiscal invoice is minted later once the proforma settles. `direct` mode is unchanged, an explicitly requested proforma conversion always wins over the mode default, and deployments without an operator-settings runtime fall back to `direct`.
