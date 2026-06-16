---
"@voyant-travel/legal": minor
---

The legal module now owns the contract-PDF generation orchestration: new exports `createContractDocumentService(options)` (+ `ensureDefaultContractSeries`, `resetContractDocumentForBooking`) from `@voyant-travel/legal` and `./contract-document`. Template resolution → variable binding → PDF render → contract-record persistence now live in the package; the deployment injects only its PDF engine, document storage, and PII providers.
