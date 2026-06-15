---
"@voyant-travel/legal": minor
---

The legal module now owns the contract-document routes. New exports:
`createContractDocumentRoutes(options)`, `CONTRACT_DOCUMENT_ROUTE_PATHS`, and
`ContractDocumentRoutesOptions` (from `@voyant-travel/legal` and
`@voyant-travel/legal/contract-document-routes`). The deployment injects the
contract generator and document storage; the route implementations
(generate-contract, private document file serving + scriptable-mime safety) no
longer live in the deployment.
