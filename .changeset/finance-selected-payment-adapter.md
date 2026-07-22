---
"@voyant-travel/finance": minor
"@voyant-travel/operator-standard": patch
---

Route Finance checkout collections through the deployment-selected `PaymentAdapter`. Providerless card-start requests now use that adapter, legacy provider hints remain compatible but cannot override deployment selection, and full generic billing metadata reaches hosted-checkout adapters.
