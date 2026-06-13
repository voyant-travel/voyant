---
"@voyantjs/finance": minor
"@voyantjs/finance-react": minor
"@voyantjs/finance-contracts": patch
"@voyantjs/checkout": patch
"@voyantjs/checkout-react": patch
"@voyantjs/plugin-netopia": patch
"@voyantjs/storefront-sdk": patch
---

Move checkout collection orchestration and React payment collection surfaces
behind Finance owner paths. The old Checkout packages now delegate to Finance
compatibility facades while payment plugins, storefront SDK helpers, and the
operator template retarget Finance checkout interfaces.
