# ADR-0018: Proposals are the travel-native bespoke sales artifact

Status: accepted
Supersedes: [ADR-0004](./0004-quotes-as-travel-native-sales-artifact.md)

## Context

ADR-0004 used legacy bespoke sales vocabulary for the staff-managed pursuit and
its immutable customer-facing revision. That collided with the Booking
Platform concept from issue #3963: a **Quote** is an immutable pricing and terms
answer produced by the booking engine before booking.

The beta line can take breaking changes and reset databases. Keeping both names
through aliases or compatibility routes would make the collision permanent.

## Decision

The bespoke sales domain is now **Proposal** and **Proposal Version**.

`Quote` is reserved for Booking Platform pricing and terms responses, such as
`catalog_quotes`, `quoteId`, `quotedAt`, and quote currency terminology. Those
pricing quote records are not sales pipeline pursuits and do not own proposal
lifecycle state.

Clean installs use proposal persistence names:

- `proposals`
- `proposal_versions`
- `proposal_version_lines`
- `proposal_participants`
- `proposal_products`
- `proposal_media`
- `proposal_delivery_requests`
- `booking_proposal_details`

The proposal TypeID prefixes are `prps`, `prpt`, `prpd`, `prvr`, `prvl`, and
`prmd`.

No compatibility surface is kept for the bespoke sales domain: no forwarding
exports, aliases, legacy routes, migration aliases, compatibility packages,
views, or dual writes.

## Consequences

Package names, API mounts, graph units, permissions, tools, lifecycle events,
legal targets, relationship entity types, React hooks, docs, tests, fixtures,
and generated authorities use Proposal vocabulary.

Historical ADR-0004 prose remains as the superseded decision record. Active
architecture and ubiquitous-language docs use Proposal terminology.
