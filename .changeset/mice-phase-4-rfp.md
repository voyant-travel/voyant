---
"@voyant-travel/mice": minor
"@voyant-travel/schema-kit": minor
---

RFP → bid → award sourcing funnel (Phase 4).

- mice: `mice_rfps` + `mice_rfp_invitations` + `mice_bids` + `mice_bid_lines` +
  `mice_bid_evaluations` — multi-supplier bid solicitation, comparison, and
  scoring (the gap CRM quote/opportunity didn't cover). `awardRfp` atomically
  accepts the winning bid, rejects the rest, and moves the RFP to `awarded`.
  Service + admin routes + rfp/bid linkables; supplier-FK refs handled.
- schema-kit: TypeID prefixes mrfp/mrfi/mbid/mbln/mbev.
- Deployment link: bid↔supplier.

Follow-up (workflow): the `mice.rfp.awarded` subscriber that auto-spawns the
legal contract + provisional room block + booking is operator-side automation,
deferred to a workflow PR.
