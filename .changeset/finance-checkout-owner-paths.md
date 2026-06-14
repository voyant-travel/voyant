---
"@voyantjs/finance": minor
"@voyantjs/finance-react": minor
"@voyantjs/finance-contracts": patch
"@voyantjs/plugin-netopia": patch
"@voyantjs/storefront-sdk": patch
---

Move checkout collection orchestration and React payment collection surfaces
behind Finance owner paths. The old Checkout workspace packages are removed
from the v1 branch while payment plugins, storefront SDK helpers, and the
operator template retarget Finance checkout interfaces.
