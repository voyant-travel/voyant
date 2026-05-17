---
"@voyantjs/legal": patch
"@voyantjs/legal-react": patch
"@voyantjs/legal-ui": patch
---

Contracts/templates UI refresh.

- `ContractDetailPage`, `ContractsPage`, `PoliciesPage`, and `TemplatesPage` rebuilt around the shared table primitives with sort/filter/empty-state parity. Detail page now surfaces lifecycle actions inline rather than in a side panel.
- New `ContractSendDialog` for kicking off the contract-send flow with recipient/CC selection and i18n strings (EN + RO).
- `useContractMutation` invalidates the contract list + detail queries after lifecycle transitions so list rows reflect the new state immediately.
- `@voyantjs/legal` lifecycle/routes/service updated to expose the data the new dialog needs (recipient hydration, send payload) and to surface lifecycle validation errors with structured codes.
