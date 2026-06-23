---
"@voyant-travel/mice-react": minor
---

MICE Programs **Sourcing** surface — RFP → bid → award on the program detail
page (the final RFC voyant#1489 Phase 4 surface).

- `ProgramRfpsSection` (`./ui`): lists a program's RFPs (title, status, due)
  and creates new ones in place. "Manage" opens the sourcing funnel for one
  RFP — invite suppliers, record bids, and award to a winning bid — rendered
  inside `ProgramDetailPage`. Only operator-settable statuses are offered;
  `awarded` / `accepted` / `rejected` are reached solely through the award flow.
- `useRfp` (RFP detail with embedded invitations + bids) and `useRfpMutation`
  (create RFP / invite / record bid / award), with schemas
  `rfpSingleResponse`, `rfpDetailResponse`, `bidSingleResponse`,
  `invitationSingleResponse`, and `awardResponse`. Funnel mutations invalidate
  both the RFP list and the RFP detail so the manage view refreshes in place.
