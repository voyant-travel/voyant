# @voyantjs/hospitality-react

Legacy React data hooks for Voyant hospitality surfaces.

This package currently follows the legacy hospitality route shape and includes
both accommodation resale hooks and hotel/property operations hooks. It is not a
normal first-party adoption surface.

Do not add it to new starters, do not use it for new hotel-management
workspaces, and do not expand PMS-style workflows such as room-unit management,
maintenance blocks, housekeeping, folios, or in-stay operations.

Keep temporary usage limited to migration support for accommodation resale
contracts that OTAs, tour operators, and DMCs still need. New accommodation
resale data hooks should move toward catalog, products, bookings, storefront,
supplier, source-adapter, or a narrowly named accommodation resale surface.

See
[`docs/architecture/accommodation-resale-boundary.md`](../../docs/architecture/accommodation-resale-boundary.md)
for the boundary.
