---
"@voyant-travel/commerce": minor
"@voyant-travel/finance": minor
"@voyant-travel/operator-settings": minor
---

Scope the operator invoicing mode to the deferred bank-transfer payment path.

Payment method now determines the document flow. Card payments always issue the fiscal invoice at checkout finalize and never consult `invoicing.mode`. Bank transfer (deferred payment) is the configurable path: `proforma-first` (now the default, matching the platform's historical behaviour) issues a proforma at order placement and mints the fiscal invoice on settlement; `direct` issues the fiscal invoice at order placement and collects the transfer against it.

The mode consult that PR #3462 added to the checkout finalize saga is removed — finalize once again always issues the fiscal invoice (or converts an existing proforma). The mode is instead wired at the bank-transfer issuance site, and its default flips from `direct` to `proforma-first` (schema default, normalization, and an additive migration that also backfills existing rows). The finance proforma-conversion subscriber no longer gates on the mode: any fully-paid proforma converts, which is correct in every mode and avoids stranding a proforma left outstanding across a mode switch.
