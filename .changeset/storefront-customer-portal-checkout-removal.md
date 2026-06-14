---
"@voyantjs/storefront": minor
"@voyantjs/storefront-react": minor
"@voyantjs/customer-portal": patch
"@voyantjs/customer-portal-react": patch
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
---

Move customer portal runtime and React surfaces under Storefront owner paths,
leaving the legacy customer-portal packages as compatibility wrappers. Remove
the retired Checkout workspace packages now that Finance and Finance React own
checkout collection services, hooks, and UI.
