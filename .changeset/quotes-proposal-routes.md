---
"@voyant-travel/quotes": minor
---

The quotes module now owns the quote-version proposal + Trip-snapshot routes.
New exports (from `@voyant-travel/quotes` and `@voyant-travel/quotes/proposal-routes`):
`createQuoteProposalAdminRoutes`, `createQuoteProposalPublicRoutes`,
`createQuoteVersionSnapshotRoutes`, `tripSnapshotToQuoteVersionApply`,
`buildQuoteVersionProposalUrl`, and `QuoteProposalRoutesOptions`. The deployment
injects db, public proposal base URL, and the trip reserve/checkout deps; the
route implementations (send, public accept/decline, snapshot freeze) no longer
live in the deployment. Adds `@voyant-travel/trips` as a dependency.
