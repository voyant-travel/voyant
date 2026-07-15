# @voyant-travel/accommodations

Accommodation resale contracts for Voyant.

This package is for OTAs, tour operators, and DMCs selling lodging as catalog
inventory or trip components. It is not a hotel-operations or PMS surface.

Retained scope includes sourced lodging content, room options, board basis,
rate plans, payment-policy lookup, booking draft shape, and catalog projection.
Do not add hotel staff workflows such as room-unit management, housekeeping,
maintenance, folios, or in-stay operations.

## Agent Tools

`@voyant-travel/accommodations/tools` contributes provider-neutral Tools for owned-stay search
and quoting, localized content resolution, and staff room-block reads and lifecycle writes. Search,
quote, and content reads support staff or customer grants with `accommodations:read`; room-block
operations are staff-only. Pickup and reversal are high-risk, ledgered, approval-gated writes.

The cutoff release operation is intentionally not a Tool: it permanently releases supplier-held
capacity and the selected graph has no destructive release action policy. Room-block listing is
also absent because the package exposes no list service; Tools do not query its tables directly.
