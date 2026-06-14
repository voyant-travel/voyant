---
"@voyant-travel/finance": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/finance-contracts": patch
"@voyant-travel/plugin-netopia": patch
"@voyant-travel/storefront-sdk": patch
---

Move checkout collection orchestration and React payment collection surfaces
behind Finance owner paths. The old Checkout workspace packages are removed
from the v1 branch while payment plugins, storefront SDK helpers, and the
operator starter retarget Finance checkout interfaces.
