# @voyant-travel/framework

## 0.12.12

### Patch Changes

- Updated dependencies [98503c9]
  - @voyant-travel/accommodations@0.109.6

## 0.12.11

### Patch Changes

- @voyant-travel/bookings@0.139.5

## 0.12.10

### Patch Changes

- Updated dependencies [ec207bd]
  - @voyant-travel/storefront@0.141.2

## 0.12.9

### Patch Changes

- Updated dependencies [4504abb]
  - @voyant-travel/inventory@0.6.1

## 0.12.8

### Patch Changes

- 32d0e1c: Split the framework standard runtime composition into lightweight per-module
  lazy route loaders, and allow overlapping lazy route mounts to fall through on
  wrapper route misses so lazy modules/extensions preserve eager route composition
  semantics without swallowing handler-authored 404 responses.
- Updated dependencies [32d0e1c]
  - @voyant-travel/hono@0.121.1
  - @voyant-travel/commerce@0.21.2
  - @voyant-travel/finance@0.139.3

## 0.12.7

### Patch Changes

- Updated dependencies [9678a59]
  - @voyant-travel/bookings@0.139.4

## 0.12.6

### Patch Changes

- 386595a: Expose a booking cancellation settlement runtime hook and persist cancellation reasons plus settlement metadata on booking activity entries.
- Updated dependencies [386595a]
  - @voyant-travel/bookings@0.139.3

## 0.12.5

### Patch Changes

- Updated dependencies [79447ce]
  - @voyant-travel/catalog@0.137.1

## 0.12.4

### Patch Changes

- Updated dependencies [ecff8cf]
  - @voyant-travel/operations@0.5.11
  - @voyant-travel/bookings@0.139.2
  - @voyant-travel/storefront@0.141.1

## 0.12.3

### Patch Changes

- Updated dependencies [a69f820]
  - @voyant-travel/commerce@0.21.1
  - @voyant-travel/bookings@0.139.1

## 0.12.2

### Patch Changes

- Updated dependencies [79cc498]
  - @voyant-travel/finance@0.139.2

## 0.12.1

### Patch Changes

- bbc2334: Expose booking tax settings through the finance admin route mount so local starters can reach `/v1/admin/finance/tax-settings` without the bookings detail route capturing the request.
- Updated dependencies [bbc2334]
  - @voyant-travel/finance@0.139.1

## 0.12.0

### Patch Changes

- 52c52fc: Declare storefront public offer detail, apply, and redeem routes as anonymous surfaces so standard hosts admit them without hand-maintained `publicPaths` entries.
- Updated dependencies [c9a356f]
- Updated dependencies [689a289]
- Updated dependencies [bf2d4a5]
- Updated dependencies [fc71db1]
- Updated dependencies [fc71db1]
- Updated dependencies [77f139b]
- Updated dependencies [6474f42]
- Updated dependencies [5786f63]
- Updated dependencies [2453207]
- Updated dependencies [922d0fd]
- Updated dependencies [f000bb3]
- Updated dependencies [28c59ea]
- Updated dependencies [05961f1]
- Updated dependencies [e1290d9]
- Updated dependencies [0c75844]
- Updated dependencies [22f0457]
- Updated dependencies [52c52fc]
- Updated dependencies [92e170a]
- Updated dependencies [f3b8bef]
- Updated dependencies [13f21a1]
- Updated dependencies [9f29b74]
- Updated dependencies [fcad28b]
- Updated dependencies [ca14f6f]
  - @voyant-travel/hono@0.121.0
  - @voyant-travel/catalog@0.137.0
  - @voyant-travel/relationships@0.122.0
  - @voyant-travel/bookings@0.139.0
  - @voyant-travel/finance@0.139.0
  - @voyant-travel/quotes@0.124.0
  - @voyant-travel/notifications@0.117.0
  - @voyant-travel/inventory@0.6.0
  - @voyant-travel/mice@0.6.5
  - @voyant-travel/commerce@0.21.0
  - @voyant-travel/storefront@0.141.0
  - @voyant-travel/distribution@0.129.0
  - @voyant-travel/trips@0.130.0
  - @voyant-travel/identity@0.139.0
  - @voyant-travel/legal@0.139.0
  - @voyant-travel/operations@0.5.10
  - @voyant-travel/accommodations@0.109.5
  - @voyant-travel/action-ledger@0.105.12
  - @voyant-travel/flights@0.139.0
  - @voyant-travel/operator-settings@0.2.23

## 0.11.5

### Patch Changes

- Updated dependencies [5e6a2ff]
- Updated dependencies [92bac99]
- Updated dependencies [5fa49b1]
- Updated dependencies [c7bd13f]
  - @voyant-travel/relationships@0.121.14
  - @voyant-travel/bookings@0.138.10
  - @voyant-travel/catalog@0.136.4

## 0.11.4

### Patch Changes

- Updated dependencies [7df89ab]
- Updated dependencies [8cb2124]
- Updated dependencies [e002da8]
  - @voyant-travel/relationships@0.121.13
  - @voyant-travel/bookings@0.138.9

## 0.11.3

### Patch Changes

- Updated dependencies [ae115de]
  - @voyant-travel/inventory@0.5.18

## 0.11.2

### Patch Changes

- Updated dependencies [b615127]
- Updated dependencies [f9c3449]
  - @voyant-travel/relationships@0.121.12
  - @voyant-travel/finance@0.138.9
  - @voyant-travel/bookings@0.138.8
  - @voyant-travel/identity@0.138.3

## 0.11.1

### Patch Changes

- Updated dependencies [46d7d52]
  - @voyant-travel/relationships@0.121.11
  - @voyant-travel/bookings@0.138.7

## 0.11.0

### Patch Changes

- Updated dependencies [1cb9cba]
- Updated dependencies [131ff9b]
- Updated dependencies [f1090b7]
- Updated dependencies [42f662c]
- Updated dependencies [fead555]
  - @voyant-travel/hono@0.120.0
  - @voyant-travel/operations@0.5.9
  - @voyant-travel/accommodations@0.109.4
  - @voyant-travel/action-ledger@0.105.11
  - @voyant-travel/bookings@0.138.6
  - @voyant-travel/catalog@0.136.3
  - @voyant-travel/commerce@0.20.5
  - @voyant-travel/distribution@0.128.4
  - @voyant-travel/finance@0.138.8
  - @voyant-travel/flights@0.138.2
  - @voyant-travel/identity@0.138.2
  - @voyant-travel/inventory@0.5.17
  - @voyant-travel/legal@0.138.2
  - @voyant-travel/mice@0.6.4
  - @voyant-travel/notifications@0.116.13
  - @voyant-travel/operator-settings@0.2.22
  - @voyant-travel/quotes@0.123.14
  - @voyant-travel/relationships@0.121.10
  - @voyant-travel/storefront@0.140.2
  - @voyant-travel/trips@0.129.2

## 0.10.0

### Patch Changes

- Updated dependencies [b254511]
- Updated dependencies [141bd2b]
- Updated dependencies [86fbb05]
  - @voyant-travel/bookings@0.138.5
  - @voyant-travel/finance@0.138.7
  - @voyant-travel/hono@0.119.0
  - @voyant-travel/accommodations@0.109.3
  - @voyant-travel/action-ledger@0.105.10
  - @voyant-travel/catalog@0.136.2
  - @voyant-travel/commerce@0.20.4
  - @voyant-travel/distribution@0.128.3
  - @voyant-travel/flights@0.138.1
  - @voyant-travel/identity@0.138.1
  - @voyant-travel/inventory@0.5.16
  - @voyant-travel/legal@0.138.1
  - @voyant-travel/mice@0.6.3
  - @voyant-travel/notifications@0.116.12
  - @voyant-travel/operations@0.5.8
  - @voyant-travel/operator-settings@0.2.21
  - @voyant-travel/quotes@0.123.13
  - @voyant-travel/relationships@0.121.9
  - @voyant-travel/storefront@0.140.1
  - @voyant-travel/trips@0.129.1

## 0.9.47

### Patch Changes

- Updated dependencies [1544a59]
- Updated dependencies [dd03968]
- Updated dependencies [2d3b039]
- Updated dependencies [bcd76ae]
- Updated dependencies [37e7758]
  - @voyant-travel/bookings@0.138.4
  - @voyant-travel/operations@0.5.7
  - @voyant-travel/catalog@0.136.1
  - @voyant-travel/inventory@0.5.15
  - @voyant-travel/commerce@0.20.3
  - @voyant-travel/finance@0.138.6

## 0.9.46

### Patch Changes

- Updated dependencies [569e2a0]
  - @voyant-travel/commerce@0.20.2
  - @voyant-travel/relationships@0.121.8

## 0.9.45

### Patch Changes

- Updated dependencies [ec41b3e]
  - @voyant-travel/finance@0.138.5

## 0.9.44

### Patch Changes

- Updated dependencies [a424cae]
  - @voyant-travel/finance@0.138.4

## 0.9.43

### Patch Changes

- Updated dependencies [9ebd8e8]
- Updated dependencies [c081c71]
- Updated dependencies [3fc4487]
- Updated dependencies [aa0135c]
- Updated dependencies [51003c6]
  - @voyant-travel/inventory@0.5.14
  - @voyant-travel/bookings@0.138.3
  - @voyant-travel/finance@0.138.3

## 0.9.42

### Patch Changes

- Updated dependencies [d388565]
- Updated dependencies [d1b4da2]
  - @voyant-travel/bookings@0.138.2
  - @voyant-travel/commerce@0.20.1
  - @voyant-travel/finance@0.138.2

## 0.9.41

### Patch Changes

- Updated dependencies [a5dfd8f]
- Updated dependencies [3cacf39]
- Updated dependencies [3757b75]
- Updated dependencies [88edbe6]
  - @voyant-travel/bookings@0.138.1
  - @voyant-travel/distribution@0.128.2
  - @voyant-travel/hono@0.118.4

## 0.9.40

### Patch Changes

- Updated dependencies [bd59b12]
- Updated dependencies [ee4cbf0]
  - @voyant-travel/distribution@0.128.1
  - @voyant-travel/finance@0.138.1

## 0.9.39

### Patch Changes

- Updated dependencies [2325c93]
  - @voyant-travel/distribution@0.128.0
  - @voyant-travel/commerce@0.20.0
  - @voyant-travel/legal@0.138.0
  - @voyant-travel/bookings@0.138.0
  - @voyant-travel/catalog@0.136.0
  - @voyant-travel/finance@0.138.0
  - @voyant-travel/flights@0.138.0
  - @voyant-travel/identity@0.138.0
  - @voyant-travel/trips@0.129.0
  - @voyant-travel/notifications@0.116.11
  - @voyant-travel/storefront@0.140.0
  - @voyant-travel/accommodations@0.109.2
  - @voyant-travel/inventory@0.5.13
  - @voyant-travel/operations@0.5.6
  - @voyant-travel/operator-settings@0.2.20
  - @voyant-travel/relationships@0.121.7
  - @voyant-travel/quotes@0.123.12

## 0.9.38

### Patch Changes

- Updated dependencies [2156dcb]
  - @voyant-travel/commerce@0.19.6
  - @voyant-travel/bookings@0.137.7

## 0.9.37

### Patch Changes

- Updated dependencies [04aa601]
  - @voyant-travel/legal@0.137.9
  - @voyant-travel/distribution@0.127.3
  - @voyant-travel/storefront@0.139.5

## 0.9.36

### Patch Changes

- Updated dependencies [cb8df9c]
- Updated dependencies [f6c8fcf]
- Updated dependencies [1d65f48]
  - @voyant-travel/catalog@0.135.8
  - @voyant-travel/legal@0.137.8
  - @voyant-travel/bookings@0.137.6
  - @voyant-travel/storefront@0.139.4

## 0.9.35

### Patch Changes

- Updated dependencies [5288b85]
- Updated dependencies [cc29167]
  - @voyant-travel/legal@0.137.7

## 0.9.34

### Patch Changes

- Updated dependencies [5928f32]
  - @voyant-travel/legal@0.137.6

## 0.9.33

### Patch Changes

- Updated dependencies [bb3b29c]
  - @voyant-travel/commerce@0.19.5

## 0.9.32

### Patch Changes

- Updated dependencies [fd17317]
- Updated dependencies [c5cd9cd]
- Updated dependencies [4c18cc6]
- Updated dependencies [53f949c]
- Updated dependencies [1e5251d]
  - @voyant-travel/hono@0.118.3
  - @voyant-travel/inventory@0.5.12
  - @voyant-travel/notifications@0.116.10
  - @voyant-travel/legal@0.137.5
  - @voyant-travel/bookings@0.137.5
  - @voyant-travel/flights@0.137.6

## 0.9.31

### Patch Changes

- Updated dependencies [5c1294f]
  - @voyant-travel/inventory@0.5.11

## 0.9.30

### Patch Changes

- @voyant-travel/flights@0.137.5

## 0.9.29

### Patch Changes

- Updated dependencies [ed5463f]
- Updated dependencies [a10b9ba]
- Updated dependencies [e005c4d]
- Updated dependencies [ad02eae]
  - @voyant-travel/operations@0.5.5
  - @voyant-travel/inventory@0.5.10
  - @voyant-travel/commerce@0.19.4
  - @voyant-travel/flights@0.137.4

## 0.9.28

### Patch Changes

- Updated dependencies [7bdd9cc]
  - @voyant-travel/finance@0.137.8
  - @voyant-travel/catalog@0.135.7

## 0.9.27

### Patch Changes

- @voyant-travel/storefront@0.139.3

## 0.9.26

### Patch Changes

- Updated dependencies [b1f90b0]
- Updated dependencies [49ffcd9]
- Updated dependencies [37e9543]
- Updated dependencies [c1d8f71]
  - @voyant-travel/trips@0.128.5
  - @voyant-travel/flights@0.137.3

## 0.9.25

### Patch Changes

- Updated dependencies [776bafd]
  - @voyant-travel/trips@0.128.4

## 0.9.24

### Patch Changes

- Updated dependencies [c6acfa5]
  - @voyant-travel/trips@0.128.3

## 0.9.23

### Patch Changes

- Updated dependencies [54041a9]
  - @voyant-travel/trips@0.128.2

## 0.9.22

### Patch Changes

- Updated dependencies [ce0f92d]
  - @voyant-travel/storefront@0.139.2
  - @voyant-travel/finance@0.137.7

## 0.9.21

### Patch Changes

- 8848457: Allow the standard public finance voucher validation route to be reached without an authenticated storefront session.
- Updated dependencies [5c53561]
- Updated dependencies [790a18d]
- Updated dependencies [2427218]
- Updated dependencies [7850b66]
- Updated dependencies [bddb539]
  - @voyant-travel/flights@0.137.2
  - @voyant-travel/quotes@0.123.11
  - @voyant-travel/finance@0.137.6

## 0.9.20

### Patch Changes

- 7d70797: Validate quote participant person IDs before creating participant records.
- Updated dependencies [7d70797]
  - @voyant-travel/quotes@0.123.10

## 0.9.19

### Patch Changes

- Updated dependencies [5cc83f5]
  - @voyant-travel/quotes@0.123.9

## 0.9.18

### Patch Changes

- Updated dependencies [23d9ee3]
  - @voyant-travel/quotes@0.123.8

## 0.9.17

### Patch Changes

- Updated dependencies [6d8f054]
  - @voyant-travel/quotes@0.123.7

## 0.9.16

### Patch Changes

- Updated dependencies [0108ccf]
  - @voyant-travel/catalog@0.135.6
  - @voyant-travel/finance@0.137.5

## 0.9.15

### Patch Changes

- Updated dependencies [dda92bd]
- Updated dependencies [24413e3]
- Updated dependencies [951409a]
- Updated dependencies [24413e3]
  - @voyant-travel/commerce@0.19.3
  - @voyant-travel/catalog@0.135.5
  - @voyant-travel/finance@0.137.4
  - @voyant-travel/hono@0.118.2

## 0.9.14

### Patch Changes

- @voyant-travel/catalog@0.135.4

## 0.9.13

### Patch Changes

- Updated dependencies [61410dd]
  - @voyant-travel/accommodations@0.109.1
  - @voyant-travel/catalog@0.135.3
  - @voyant-travel/inventory@0.5.9
  - @voyant-travel/bookings@0.137.4

## 0.9.12

### Patch Changes

- @voyant-travel/bookings@0.137.3

## 0.9.11

### Patch Changes

- @voyant-travel/bookings@0.137.2

## 0.9.10

### Patch Changes

- @voyant-travel/distribution@0.127.2

## 0.9.9

### Patch Changes

- Updated dependencies [eb9285a]
  - @voyant-travel/commerce@0.19.2

## 0.9.8

### Patch Changes

- Updated dependencies [6d3e0a5]
  - @voyant-travel/accommodations@0.109.0
  - @voyant-travel/mice@0.6.2

## 0.9.7

### Patch Changes

- d2ec289: Expose a framework provider override for finance payment-schedule line description formatting.

## 0.9.6

### Patch Changes

- Updated dependencies [98e270c]
- Updated dependencies [d2351e0]
  - @voyant-travel/inventory@0.5.8
  - @voyant-travel/catalog@0.135.2

## 0.9.5

### Patch Changes

- Updated dependencies [154a6c2]
  - @voyant-travel/hono@0.118.1
  - @voyant-travel/finance@0.137.3

## 0.9.4

### Patch Changes

- Updated dependencies [bcea95d]
  - @voyant-travel/legal@0.137.4

## 0.9.3

### Patch Changes

- Updated dependencies [5145a69]
  - @voyant-travel/legal@0.137.3

## 0.9.2

### Patch Changes

- Updated dependencies [4eda12a]
- Updated dependencies [89cc2c4]
  - @voyant-travel/finance@0.137.2
  - @voyant-travel/notifications@0.116.9

## 0.9.1

### Patch Changes

- Updated dependencies [fcb8b88]
- Updated dependencies [d2df4c1]
  - @voyant-travel/inventory@0.5.7
  - @voyant-travel/operations@0.5.4
  - @voyant-travel/legal@0.137.2

## 0.9.0

### Minor Changes

- 9a1197b: Move the operator media upload and serve routes off the bare `/v1/*` surface and onto `/v1/admin/*`.

  Uploads now post to `/v1/admin/uploads` and video tickets to `/v1/admin/uploads/video`; stored media is served from `/v1/admin/media/*`. The Hono app no longer mounts the bare `/v1/*` catch-all actor guard, and worker-runtime hosts can use `rewriteAppPath` to preserve compatibility for persisted legacy media URLs.

### Patch Changes

- Updated dependencies [9a1197b]
  - @voyant-travel/hono@0.118.0
  - @voyant-travel/storefront@0.139.1
  - @voyant-travel/finance@0.137.1
  - @voyant-travel/inventory@0.5.6
  - @voyant-travel/legal@0.137.1
  - @voyant-travel/accommodations@0.108.3
  - @voyant-travel/action-ledger@0.105.9
  - @voyant-travel/bookings@0.137.1
  - @voyant-travel/catalog@0.135.1
  - @voyant-travel/commerce@0.19.1
  - @voyant-travel/distribution@0.127.1
  - @voyant-travel/flights@0.137.1
  - @voyant-travel/identity@0.137.1
  - @voyant-travel/mice@0.6.1
  - @voyant-travel/notifications@0.116.8
  - @voyant-travel/operations@0.5.3
  - @voyant-travel/operator-settings@0.2.19
  - @voyant-travel/quotes@0.123.6
  - @voyant-travel/relationships@0.121.6
  - @voyant-travel/trips@0.128.1

## 0.8.1

### Patch Changes

- Updated dependencies [ed31e95]
  - @voyant-travel/mice@0.6.0

## 0.8.0

### Patch Changes

- Updated dependencies [7c5ee80]
  - @voyant-travel/hono@0.117.0
  - @voyant-travel/commerce@0.19.0
  - @voyant-travel/accommodations@0.108.2
  - @voyant-travel/action-ledger@0.105.8
  - @voyant-travel/bookings@0.137.0
  - @voyant-travel/catalog@0.135.0
  - @voyant-travel/distribution@0.127.0
  - @voyant-travel/finance@0.137.0
  - @voyant-travel/flights@0.137.0
  - @voyant-travel/identity@0.137.0
  - @voyant-travel/inventory@0.5.5
  - @voyant-travel/legal@0.137.0
  - @voyant-travel/mice@0.5.2
  - @voyant-travel/notifications@0.116.7
  - @voyant-travel/operations@0.5.2
  - @voyant-travel/operator-settings@0.2.18
  - @voyant-travel/quotes@0.123.5
  - @voyant-travel/relationships@0.121.5
  - @voyant-travel/storefront@0.139.0
  - @voyant-travel/trips@0.128.0

## 0.7.7

### Patch Changes

- Updated dependencies [12a1eb2]
  - @voyant-travel/accommodations@0.108.1
  - @voyant-travel/bookings@0.136.2
  - @voyant-travel/commerce@0.18.1
  - @voyant-travel/distribution@0.126.2
  - @voyant-travel/finance@0.136.2
  - @voyant-travel/hono@0.116.2
  - @voyant-travel/inventory@0.5.4
  - @voyant-travel/legal@0.136.2
  - @voyant-travel/mice@0.5.1
  - @voyant-travel/notifications@0.116.6
  - @voyant-travel/operations@0.5.1
  - @voyant-travel/quotes@0.123.4
  - @voyant-travel/relationships@0.121.4
  - @voyant-travel/identity@0.136.2

## 0.7.6

### Patch Changes

- 6a8e6bc: Expose standard finance checkout policy and notifications auto-dispatch policy as optional framework provider fields.

## 0.7.5

### Patch Changes

- @voyant-travel/bookings@0.136.1
- @voyant-travel/catalog@0.134.1
- @voyant-travel/distribution@0.126.1
- @voyant-travel/finance@0.136.1
- @voyant-travel/flights@0.136.1
- @voyant-travel/identity@0.136.1
- @voyant-travel/legal@0.136.1
- @voyant-travel/notifications@0.116.5
- @voyant-travel/trips@0.127.1

## 0.7.4

### Patch Changes

- Updated dependencies [4ad1bf7]
  - @voyant-travel/mice@0.5.0

## 0.7.3

### Patch Changes

- Updated dependencies [722455d]
  - @voyant-travel/mice@0.4.0

## 0.7.2

### Patch Changes

- Updated dependencies [06cfcf5]
  - @voyant-travel/mice@0.3.0

## 0.7.1

### Patch Changes

- Updated dependencies [787c852]
- Updated dependencies [293e5e4]
  - @voyant-travel/accommodations@0.108.0
  - @voyant-travel/operations@0.5.0
  - @voyant-travel/hono@0.116.1
  - @voyant-travel/inventory@0.5.3
  - @voyant-travel/storefront@0.138.0
  - @voyant-travel/bookings@0.136.0
  - @voyant-travel/catalog@0.134.0
  - @voyant-travel/distribution@0.126.0
  - @voyant-travel/finance@0.136.0
  - @voyant-travel/flights@0.136.0
  - @voyant-travel/identity@0.136.0
  - @voyant-travel/legal@0.136.0
  - @voyant-travel/trips@0.127.0
  - @voyant-travel/commerce@0.18.0
  - @voyant-travel/notifications@0.116.4
  - @voyant-travel/operator-settings@0.2.17
  - @voyant-travel/relationships@0.121.3
  - @voyant-travel/quotes@0.123.3

## 0.7.0

### Minor Changes

- 924d201: Room-block allotment (Phase 1) + MICE program spine.

  - accommodations: `room_blocks` / `room_block_nights` / `room_block_pickups` with
    per-night counters, CHECK invariants, an append-only pickup ledger, and a
    transactional pickup/reversal/cutoff-release service; first
    `accommodationsHonoModule` (registered in the framework standard set) +
    `roomBlockLinkable`.
  - operations: `property` / `facility` linkable definitions.
  - mice (new): `mice_programs` umbrella + admin routes + `programLinkable`,
    mounted operator-local.
  - schema-kit: TypeID prefixes `hrbn` / `hrbp` / `prog`.

### Patch Changes

- Updated dependencies [924d201]
- Updated dependencies [f311826]
  - @voyant-travel/accommodations@0.107.0
  - @voyant-travel/mice@0.2.0
  - @voyant-travel/operations@0.4.0
  - @voyant-travel/inventory@0.5.2
  - @voyant-travel/storefront@0.137.0
  - @voyant-travel/bookings@0.135.0
  - @voyant-travel/catalog@0.133.0
  - @voyant-travel/distribution@0.125.0
  - @voyant-travel/finance@0.135.0
  - @voyant-travel/flights@0.135.0
  - @voyant-travel/identity@0.135.0
  - @voyant-travel/legal@0.135.0
  - @voyant-travel/trips@0.126.0
  - @voyant-travel/commerce@0.17.0
  - @voyant-travel/notifications@0.116.3
  - @voyant-travel/operator-settings@0.2.16
  - @voyant-travel/relationships@0.121.2
  - @voyant-travel/quotes@0.123.2

## 0.6.1

### Patch Changes

- Updated dependencies [fac9297]
  - @voyant-travel/notifications@0.116.2

## 0.6.0

### Minor Changes

- 2542715: Transactional-path declarations (ADR-0008 Phase 2). `HonoModule`/`HonoExtension` gain `transactionalPaths?: string[]` — absolute API path prefixes that must be served by the transaction-capable db client, for routes mounted outside the name-based surface where only a _subset_ transacts (e.g. a lazy family at `/v1/admin/catalog/quote`). `mountApp` folds these into the transactional-prefix map alongside the existing name-based `requiresTransactionalDb`, so a deployment no longer hand-maintains `dbTransactionalPaths`.

  The standard families now declare their own transactional surface: `@voyant-travel/trips` is name-based `requiresTransactionalDb` (every trips route reserves), and the catalog booking engine (`operator/catalog-booking`) declares its `quote`/`book`/`holds`/`orders` prefixes via `transactionalPaths` (search/draft/snapshot reads stay on the cheap default client). The operator starter's `dbTransactionalPaths` list is removed entirely.

  Additive and non-breaking: `dbTransactionalPaths` is still honored as an escape hatch; a module that declares neither flag is unaffected.

### Patch Changes

- Updated dependencies [684b321]
- Updated dependencies [2542715]
  - @voyant-travel/hono@0.116.0
  - @voyant-travel/action-ledger@0.105.7
  - @voyant-travel/bookings@0.134.1
  - @voyant-travel/catalog@0.132.1
  - @voyant-travel/commerce@0.16.1
  - @voyant-travel/distribution@0.124.1
  - @voyant-travel/finance@0.134.1
  - @voyant-travel/flights@0.134.1
  - @voyant-travel/identity@0.134.1
  - @voyant-travel/inventory@0.5.1
  - @voyant-travel/legal@0.134.1
  - @voyant-travel/notifications@0.116.1
  - @voyant-travel/operations@0.3.1
  - @voyant-travel/operator-settings@0.2.15
  - @voyant-travel/quotes@0.123.1
  - @voyant-travel/relationships@0.121.1
  - @voyant-travel/storefront@0.136.1
  - @voyant-travel/trips@0.125.1

## 0.5.0

### Minor Changes

- 04b257c: Anonymous-access declarations (ADR-0008 Phase 1). A module/extension can now declare which of its PUBLIC routes are reachable without a session via an `anonymous?: boolean | string[]` field on `HonoModule`/`HonoExtension` — `true` opens the whole public mount, a string array opens specific sub-paths relative to it. `createApp` assembles the global anonymous allow-list from these declarations (unioned with any explicit `publicPaths`, now an escape hatch) and feeds it to both the auth middleware and the public-write rate-limit matcher, so the "reachable-without-auth" decision lives next to the route instead of in a hand-maintained list. New pure helper `assembleAnonymousPaths(modules, extensions, explicit)` is exported for tooling/audit.

  The standard framework families that own anonymous routes now declare it (catalog, bookings, finance payment/collections/accountant sub-paths, legal, public-document-delivery, storefront verification + intake, customer-portal contact-exists, proposals); the framework's `anonymous-surface` test asserts the full assembled standard surface as an auditable snapshot.

  Additive and non-breaking: a deployment that declares no `anonymous` and passes `publicPaths` explicitly gets identical behavior.

- 78c15fa: Module subsetting, Phase 1 (ADR-0007). The standard set is default-on; `createVoyantApp` now accepts `exclude` — a list of standard module/extension specifiers to REMOVE from the framework set, for a deployment that doesn't run them (e.g. `@voyant-travel/flights`).

  Excludes are validated against the new `FRAMEWORK_CAPABILITY_GRAPH` (declaring `provides`/`requires`/`isRequired`): excluding a module another mounted module depends on, an `isRequired` foundational module, or a specifier not in the standard set throws a named boot error listing what's wrong — never a runtime 500. Adds the pure validators `findCapabilityGaps` (`@voyant-travel/hono/composition`) and `subsetStandardManifest` (`@voyant-travel/framework`).

  Additive and non-breaking: omitting `exclude` mounts the full standard set exactly as before.

  Capability _replacement_ (swap Voyant CRM for HubSpot via override-by-capability + injected ports) is the documented v2 design and intentionally not wired yet — the `PeopleDirectory` port doesn't exist, so a replace knob would silently mis-resolve. Removal works today; replacement, schema-side subsetting, and the port extraction are tracked follow-ups.

### Patch Changes

- Updated dependencies [04b257c]
- Updated dependencies [78c15fa]
- Updated dependencies [51f7dea]
  - @voyant-travel/hono@0.115.0
  - @voyant-travel/bookings@0.134.0
  - @voyant-travel/commerce@0.16.0
  - @voyant-travel/distribution@0.124.0
  - @voyant-travel/finance@0.134.0
  - @voyant-travel/identity@0.134.0
  - @voyant-travel/inventory@0.5.0
  - @voyant-travel/legal@0.134.0
  - @voyant-travel/notifications@0.116.0
  - @voyant-travel/operations@0.3.0
  - @voyant-travel/quotes@0.123.0
  - @voyant-travel/relationships@0.121.0
  - @voyant-travel/action-ledger@0.105.6
  - @voyant-travel/catalog@0.132.0
  - @voyant-travel/flights@0.134.0
  - @voyant-travel/operator-settings@0.2.14
  - @voyant-travel/storefront@0.136.0
  - @voyant-travel/trips@0.125.0

## 0.4.0

### Patch Changes

- Updated dependencies [4abf9a2]
- Updated dependencies [b68d6a7]
- Updated dependencies [bba70ee]
  - @voyant-travel/hono@0.114.0
  - @voyant-travel/bookings@0.133.0
  - @voyant-travel/legal@0.133.0
  - @voyant-travel/trips@0.124.0
  - @voyant-travel/action-ledger@0.105.5
  - @voyant-travel/catalog@0.131.0
  - @voyant-travel/commerce@0.15.0
  - @voyant-travel/distribution@0.123.0
  - @voyant-travel/finance@0.133.0
  - @voyant-travel/flights@0.133.0
  - @voyant-travel/identity@0.133.0
  - @voyant-travel/inventory@0.4.7
  - @voyant-travel/notifications@0.115.0
  - @voyant-travel/operations@0.2.8
  - @voyant-travel/operator-settings@0.2.13
  - @voyant-travel/quotes@0.122.11
  - @voyant-travel/relationships@0.120.13
  - @voyant-travel/storefront@0.135.0

## 0.3.1

### Patch Changes

- Updated dependencies [6a0edd2]
  - @voyant-travel/catalog@0.130.0
  - @voyant-travel/flights@0.132.0
  - @voyant-travel/commerce@0.14.0
  - @voyant-travel/distribution@0.122.0
  - @voyant-travel/inventory@0.4.6
  - @voyant-travel/operations@0.2.7
  - @voyant-travel/trips@0.123.0
  - @voyant-travel/bookings@0.132.0
  - @voyant-travel/quotes@0.122.10
  - @voyant-travel/finance@0.132.0
  - @voyant-travel/identity@0.132.0
  - @voyant-travel/legal@0.132.0
  - @voyant-travel/notifications@0.114.9
  - @voyant-travel/storefront@0.134.0
  - @voyant-travel/operator-settings@0.2.12
  - @voyant-travel/relationships@0.120.12

## 0.3.0

### Patch Changes

- Updated dependencies [021ec00]
  - @voyant-travel/hono@0.113.0
  - @voyant-travel/action-ledger@0.105.4
  - @voyant-travel/bookings@0.131.1
  - @voyant-travel/catalog@0.129.1
  - @voyant-travel/commerce@0.13.1
  - @voyant-travel/distribution@0.121.1
  - @voyant-travel/finance@0.131.2
  - @voyant-travel/flights@0.131.1
  - @voyant-travel/identity@0.131.1
  - @voyant-travel/inventory@0.4.5
  - @voyant-travel/legal@0.131.1
  - @voyant-travel/notifications@0.114.8
  - @voyant-travel/operations@0.2.6
  - @voyant-travel/operator-settings@0.2.11
  - @voyant-travel/quotes@0.122.9
  - @voyant-travel/relationships@0.120.11
  - @voyant-travel/storefront@0.133.1
  - @voyant-travel/trips@0.122.1

## 0.2.22

### Patch Changes

- Updated dependencies [8c9a402]
  - @voyant-travel/finance@0.131.1

## 0.2.21

### Patch Changes

- Updated dependencies [ba89f0b]
  - @voyant-travel/operations@0.2.5

## 0.2.20

### Patch Changes

- Updated dependencies [fcd2e0b]
  - @voyant-travel/inventory@0.4.4

## 0.2.19

### Patch Changes

- @voyant-travel/bookings@0.131.0
- @voyant-travel/catalog@0.129.0
- @voyant-travel/distribution@0.121.0
- @voyant-travel/finance@0.131.0
- @voyant-travel/flights@0.131.0
- @voyant-travel/identity@0.131.0
- @voyant-travel/legal@0.131.0
- @voyant-travel/trips@0.122.0
- @voyant-travel/commerce@0.13.0
- @voyant-travel/notifications@0.114.7
- @voyant-travel/storefront@0.133.0
- @voyant-travel/inventory@0.4.3
- @voyant-travel/operations@0.2.4
- @voyant-travel/operator-settings@0.2.10
- @voyant-travel/relationships@0.120.10
- @voyant-travel/quotes@0.122.8

## 0.2.18

### Patch Changes

- @voyant-travel/bookings@0.130.0
- @voyant-travel/catalog@0.128.0
- @voyant-travel/distribution@0.120.0
- @voyant-travel/finance@0.130.0
- @voyant-travel/flights@0.130.0
- @voyant-travel/identity@0.130.0
- @voyant-travel/legal@0.130.0
- @voyant-travel/trips@0.121.0
- @voyant-travel/commerce@0.12.0
- @voyant-travel/notifications@0.114.6
- @voyant-travel/storefront@0.132.0
- @voyant-travel/inventory@0.4.2
- @voyant-travel/operations@0.2.3
- @voyant-travel/operator-settings@0.2.9
- @voyant-travel/relationships@0.120.9
- @voyant-travel/quotes@0.122.7

## 0.2.17

### Patch Changes

- Updated dependencies [733bf33]
  - @voyant-travel/commerce@0.11.1
  - @voyant-travel/storefront@0.131.1

## 0.2.16

### Patch Changes

- Updated dependencies [466e576]
  - @voyant-travel/legal@0.129.1

## 0.2.15

### Patch Changes

- Updated dependencies [c5416cb]
  - @voyant-travel/trips@0.120.1
  - @voyant-travel/quotes@0.122.6

## 0.2.14

### Patch Changes

- Updated dependencies [4a6d62f]
  - @voyant-travel/bookings@0.129.1

## 0.2.13

### Patch Changes

- Updated dependencies [7929dae]
  - @voyant-travel/relationships@0.120.8

## 0.2.12

### Patch Changes

- Updated dependencies [e014a02]
  - @voyant-travel/distribution@0.119.1

## 0.2.11

### Patch Changes

- Updated dependencies [7779772]
  - @voyant-travel/catalog@0.127.0
  - @voyant-travel/commerce@0.11.0
  - @voyant-travel/distribution@0.119.0
  - @voyant-travel/flights@0.129.0
  - @voyant-travel/inventory@0.4.1
  - @voyant-travel/operations@0.2.2
  - @voyant-travel/trips@0.120.0
  - @voyant-travel/quotes@0.122.5
  - @voyant-travel/bookings@0.129.0
  - @voyant-travel/finance@0.129.0
  - @voyant-travel/identity@0.129.0
  - @voyant-travel/legal@0.129.0
  - @voyant-travel/notifications@0.114.5
  - @voyant-travel/storefront@0.131.0
  - @voyant-travel/operator-settings@0.2.8
  - @voyant-travel/relationships@0.120.7

## 0.2.10

### Patch Changes

- Updated dependencies [63e99ca]
  - @voyant-travel/storefront@0.130.0

## 0.2.9

### Patch Changes

- Updated dependencies [9c47b00]
  - @voyant-travel/inventory@0.4.0
  - @voyant-travel/storefront@0.129.0
  - @voyant-travel/bookings@0.128.0
  - @voyant-travel/catalog@0.126.0
  - @voyant-travel/distribution@0.118.0
  - @voyant-travel/finance@0.128.0
  - @voyant-travel/flights@0.128.0
  - @voyant-travel/identity@0.128.0
  - @voyant-travel/legal@0.128.0
  - @voyant-travel/trips@0.119.0
  - @voyant-travel/commerce@0.10.0
  - @voyant-travel/notifications@0.114.4
  - @voyant-travel/operations@0.2.1
  - @voyant-travel/operator-settings@0.2.7
  - @voyant-travel/relationships@0.120.6
  - @voyant-travel/quotes@0.122.4

## 0.2.8

### Patch Changes

- Updated dependencies [435a5d1]
- Updated dependencies [c143531]
  - @voyant-travel/operations@0.2.0
  - @voyant-travel/bookings@0.127.0
  - @voyant-travel/flights@0.127.0
  - @voyant-travel/inventory@0.3.9
  - @voyant-travel/storefront@0.128.0
  - @voyant-travel/commerce@0.9.0
  - @voyant-travel/distribution@0.117.0
  - @voyant-travel/finance@0.127.0
  - @voyant-travel/legal@0.127.0
  - @voyant-travel/notifications@0.114.3
  - @voyant-travel/trips@0.118.0
  - @voyant-travel/catalog@0.125.0
  - @voyant-travel/identity@0.127.0
  - @voyant-travel/operator-settings@0.2.6
  - @voyant-travel/quotes@0.122.3
  - @voyant-travel/relationships@0.120.5

## 0.2.7

### Patch Changes

- Updated dependencies [fc678e9]
  - @voyant-travel/inventory@0.3.8

## 0.2.6

### Patch Changes

- Updated dependencies [1841ce2]
- Updated dependencies [4893352]
  - @voyant-travel/relationships@0.120.4
  - @voyant-travel/quotes@0.122.2
  - @voyant-travel/identity@0.126.1
  - @voyant-travel/distribution@0.116.1
  - @voyant-travel/inventory@0.3.7
  - @voyant-travel/commerce@0.8.1
  - @voyant-travel/catalog@0.124.1
  - @voyant-travel/finance@0.126.1
  - @voyant-travel/notifications@0.114.2
  - @voyant-travel/legal@0.126.1
  - @voyant-travel/storefront@0.127.1
  - @voyant-travel/operator-settings@0.2.5
  - @voyant-travel/action-ledger@0.105.3
  - @voyant-travel/trips@0.117.1
  - @voyant-travel/operations@0.1.7

## 0.2.5

### Patch Changes

- Updated dependencies [84b9d4b]
  - @voyant-travel/legal@0.126.0
  - @voyant-travel/commerce@0.8.0
  - @voyant-travel/notifications@0.114.1
  - @voyant-travel/storefront@0.127.0
  - @voyant-travel/inventory@0.3.6
  - @voyant-travel/bookings@0.126.0
  - @voyant-travel/catalog@0.124.0
  - @voyant-travel/distribution@0.116.0
  - @voyant-travel/finance@0.126.0
  - @voyant-travel/flights@0.126.0
  - @voyant-travel/identity@0.126.0
  - @voyant-travel/trips@0.117.0
  - @voyant-travel/operations@0.1.6
  - @voyant-travel/operator-settings@0.2.4
  - @voyant-travel/relationships@0.120.3
  - @voyant-travel/quotes@0.122.1

## 0.2.4

### Patch Changes

- Updated dependencies [e89640b]
  - @voyant-travel/operator-settings@0.2.3
  - @voyant-travel/action-ledger@0.105.2
  - @voyant-travel/trips@0.116.1

## 0.2.3

### Patch Changes

- @voyant-travel/catalog@0.123.1

## 0.2.2

### Patch Changes

- Updated dependencies [a74471e]
  - @voyant-travel/quotes@0.122.0
  - @voyant-travel/commerce@0.7.0
  - @voyant-travel/inventory@0.3.5
  - @voyant-travel/storefront@0.126.0
  - @voyant-travel/bookings@0.125.0
  - @voyant-travel/catalog@0.123.0
  - @voyant-travel/distribution@0.115.0
  - @voyant-travel/finance@0.125.0
  - @voyant-travel/flights@0.125.0
  - @voyant-travel/identity@0.125.0
  - @voyant-travel/legal@0.125.0
  - @voyant-travel/notifications@0.114.0
  - @voyant-travel/trips@0.116.0
  - @voyant-travel/operations@0.1.5
  - @voyant-travel/operator-settings@0.2.2
  - @voyant-travel/relationships@0.120.2
  - @voyant-travel/hono@0.112.2

## 0.2.1

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/bookings@0.124.0
- @voyant-travel/catalog@0.122.0
- @voyant-travel/distribution@0.114.0
- @voyant-travel/finance@0.124.0
- @voyant-travel/flights@0.124.0
- @voyant-travel/identity@0.124.0
- @voyant-travel/legal@0.124.0
- @voyant-travel/notifications@0.113.0
- @voyant-travel/storefront@0.125.0
- @voyant-travel/trips@0.115.0
- @voyant-travel/commerce@0.6.0
- @voyant-travel/inventory@0.3.4
- @voyant-travel/operations@0.1.4
- @voyant-travel/operator-settings@0.2.1
- @voyant-travel/relationships@0.120.1
- @voyant-travel/quotes@0.121.1

## 0.2.0

### Minor Changes

- 04681f3: Adopt custom fields on `booking` — the first entity consumer of the `@voyant-travel/core/custom-fields` registry.

  - A `custom_fields jsonb default '{}'` column on `bookings` (framework bundle migration `0001`).
  - Booking create/update routes validate the `customFields` payload at the boundary against the deployment's injected registry (`validateBookingCustomFields`): unknown keys, missing required, and wrong types are rejected 400; only registry-approved values are persisted. Writes that carry `customFields` when the deployment declares none are rejected.
  - The registry is injected through `BookingRouteRuntimeOptions.customFields` → `createBookingsHonoModule` → a new optional `FrameworkProviders.customFields` provider, which a deployment supplies (the operator wires its discovered `operatorCustomFields`).

  Read paths return `custom_fields` as part of the booking row. Oracle-verified (`bundle + links == live schema`). Per-entity adoption continues with `person`/`product`; export/invoice/search consumption of `customFieldsVisibleIn` is a follow-up. See `docs/architecture/custom-fields.md`.

- 9c3fe53: Custom-fields unification (phase 2 — person/organization adopt the `custom_fields` column). Both `people` and `organizations` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0002`), and their create/update routes validate `customFields` at the write boundary against the resolved registry (code ∪ runtime `custom_field_definitions`):

  - `relationships`: `RelationshipsRouteRuntime(+Options).customFields` resolver; a `validateRelationshipsCustomFields(c, entity, data)` helper on the accounts route (its `Env` now exposes `container`); person/org writes persist the cleaned value.
  - `relationships-contracts`: `customFields` added to the person/organization core schemas.
  - `framework`: the relationships factory moves Tier 1 → 2 to receive `capabilities.customFields`.

  Values now live on the entity row for `booking`, `person`, and `organization`. Still ahead: repoint the EAV value API to the column + backfill `custom_field_values` → jsonb, then retire the side table. Oracle-verified (bundle + links == live schema).

- 3d0c070: New `@voyant-travel/framework` BOM (bill of materials) package. Its `dependencies` pin the tested runtime-module set (the 16 mounted modules), so a deployment tracks **one framework version** and upgrades atomically — no per-package compatibility matrix. Deliberately not global lockstep: runtime packages keep independent versions (only changed ones republish, avoiding the per-package npm email spam), and the BOM is the single package that tracks the framework version. The dep list is generated from the membership manifest (`scripts/generate-framework-bom.mjs`), gated in CI via `verify:framework-bom`. Exports `FRAMEWORK_RUNTIME_PACKAGES` for `voyant upgrade`.
- d222e9f: **Convergence (Workstream B step 3):** `@voyant-travel/framework` now exports `createVoyantApp({ providers, modules?, extensions?, …config })` — the config-driven front door. It assembles the framework-owned standard set (`FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition`) with the deployment's injected providers and any deployment-local module/extension additions, then delegates to `@voyant-travel/hono`'s lower-level `createApp`.

  A standard deployment's `app.ts` collapses to a single `createVoyantApp({ providers: buildOperatorProviders(), modules: deploymentLocalModules, …db/workflows/outbox/publicPaths })` call — no hand-maintained manifest or registry. The operator starter is converged: `buildOperatorCapabilities → buildOperatorProviders`, the two deployment-local module factories are extracted to `deploymentLocalModules`, and `OPERATOR_RUNTIME_MANIFEST` / `operatorComposition` remain only as derived exports for `voyant db doctor` parity + the composition tests.

  (hono: docstring on `createApp` updated to point standard deployments at `createVoyantApp`.)

- c96beb8: Add `modulesFromGlob` + `defineDeploymentModule` — the runtime half of the "build your own module without forking" seam. A deployment feeds a Vite `import.meta.glob("../modules/*/index.ts", { eager: true })` (compiled to static imports at build time — Workers-safe) into `modulesFromGlob`, which keys each custom module by its `<name>` directory and normalizes its default export (a `HonoModule` or `ModuleFactory`, via `defineDeploymentModule`) into the composition registry.

  Pairs with the deployment drizzle config glob (`src/modules/*/schema.ts`) so a custom module's tables are migrated as a deployment source after the framework bundle. See `docs/architecture/custom-modules.md`.

- 7cff632: Add `extensionsFromGlob` + `defineDeploymentExtension` — the extension counterpart to `modulesFromGlob`/`defineDeploymentModule`. A deployment drops a `HonoExtension` into `src/extensions/<name>/index.ts` (custom routes on an _existing_ module, e.g. `/v1/admin/bookings/notes`) and it is auto-discovered and mounted via `import.meta.glob`, keyed by directory name. Pairs with the deployment drizzle config glob (`src/extensions/*/schema.ts`) so an extension that owns tables is migrated as a deployment source after the framework bundle.

  Completes the "build your own routes/modules without forking" seam (custom module + custom extension). See `docs/architecture/custom-modules.md`.

- 0f65f95: `FRAMEWORK_RUNTIME_MANIFEST` now owns the `operator/*` **standard** family entries (the 6 lazy modules — mcp, catalog-booking, catalog-content, media, payment-link, contract-document — and all 7 lazy extensions), matching the `frameworkComposition` registry that already owns their factories.

  The deployment's `OPERATOR_RUNTIME_MANIFEST` collapses to `[...FRAMEWORK_RUNTIME_MANIFEST.modules, "operator/invitations", "operator/operator-settings"]` for modules and `[...FRAMEWORK_RUNTIME_MANIFEST.extensions]` for extensions — i.e. it appends only the two genuinely deployment-local module families and zero deployment-local extensions.

  Composed module/extension counts are unchanged (29 / 15). The relative mount order of the standard families is preserved; only `invitations` + `operator-settings` (disjoint absolute-path lazy families) move to the end of the module list, which is mount-order-immaterial. This is the manifest-ownership prerequisite for the `createApp({ config, providers, extensions })` convergence.

- 74574cd: `@voyant-travel/framework` now owns the standard runtime composition manifest (`FRAMEWORK_RUNTIME_MANIFEST` — the ordered 21 package modules + 8 package extensions). The operator deployment spreads it and appends only its deployment-local `operator/*` families, so adding a standard module to the framework auto-joins the default set without the deployment re-listing it. First slice of Workstream B (the standard composition relocation); the registry factories relocate next.
- cfa613b: The framework now owns the **standard runtime composition registry**, not just the BOM + manifest. New exports:

  - `frameworkComposition` — a `CompositionRegistry` of the package-owned standard factories a deployment spreads into its own registry (`{ ...frameworkComposition.modules }`), so `composeFromManifest` sees one complete registry while the deployment shrinks.
  - `FrameworkProviders` — the typed, injected provider surface the standard factories read off `ctx.capabilities` (the deployment's capability container is a structural superset).

  This first slice (Workstream B, Tier 1) relocates the pure singleton module factories — action-ledger, relationships, quotes, operations, identity, distribution, commerce, inventory — which take no providers. Capability-shaped factories and the lazy `operator/*` route loaders follow in later tiers.

- ec8018f: Relocate the first capability-shaped standard module factories into `frameworkComposition` (Workstream B, Tier 2a): **bookings, storefront/customer-portal, storefront/verification, trips**. These read injected providers off `ctx.capabilities` rather than being hand-wired in the deployment.

  `FrameworkProviders` gains its first real fields — `relationshipsService`, `closePaymentSchedulesForBooking`, `resolveDocumentDownloadUrl`, `resolveNotificationProviders`, `createTripsRoutesOptions` — each typed by the package option type it feeds (`NonNullable<XOptions["field"]>`) or by a package service (`typeof relationshipsService`), so the provider contract can't drift from what the factories pass it into. A deployment's capability container now structurally `extends FrameworkProviders`.

  `public-document-delivery` is intentionally deferred: its storage provider takes the deployment's narrow `CloudflareBindings`, which surfaces a bindings-variance design question for the provider contract — to be resolved with the storage/document group rather than papered over.

- c31e566: Relocate the **catalog** and **storefront** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains:

  - `resolveCatalogRuntime` — typed `CatalogSearchRoutesOptions["resolveRuntime"]`. The deployment adapts its `buildCatalogContext` (a Hono-`Context` → catalog runtime mapping) into this shape, so the framework factory consumes the package's runtime contract directly.
  - `storefrontIntakePersistence` — the exported `StorefrontIntakePersistence`, built from the deployment's relationships-backed intake runtime.

  The framework's storefront factory builds its commerce offer resolvers from the package (`createCommerceStorefrontOfferResolvers`); only the deployment-specific intake persistence + `resolveDb` are injected.

- 529f340: Relocate the **public-document-delivery** and **notifications** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains `resolvePublicCheckoutBaseUrl` and `readDocumentContentBase64` (notifications); public-document-delivery reuses the `createOperatorDocumentStorage` provider added with legal.

  This resolves the public-document-delivery deferral from Tier 2a: routing its `resolveStorage` through the uniform `unknown`-bindings `createOperatorDocumentStorage` adapter (rather than the narrow-`CloudflareBindings` `createDocumentStorage`) keeps the provider contract uniform and lets the deployment retire `createDocumentStorage` entirely.

- e5ce077: Relocate the **inventory/extras** and **bookings/requirements** module factories into `frameworkComposition` (Workstream B, Tier 2b).

  - `inventory/extras` — the combined inventory+bookings extras surface (`new Hono().route(inventoryExtrasRoutes).route(bookingsExtrasRoutes)`) is now built in the framework. This adds `hono` as a **dev + peer** dependency (the framework's first plain-`hono` value usage; kept out of the BOM-locked `dependencies`).
  - `bookings/requirements` — `FrameworkProviders` gains `resolveBookingRequirementsProductSnapshot`, typed via `BookingRequirementsHonoModuleOptions` indexed access.

- 9dc4aa0: Relocate the **finance** module factory into `frameworkComposition` (Workstream B, Tier 2b — completes Tier 2). This is the last and largest capability-shaped module: its notifications→checkout adapter helpers (`toCheckoutNotificationDelivery`, `toCheckoutReminderRun`, `optionalDateTime` + the `NotificationDeliveryLike`/`NotificationReminderRunLike` types) move into the framework alongside the factory.

  `FrameworkProviders` gains `createInvoiceExchangeRateResolver`, `createInvoiceSettlementPollers`, `resolveBankTransferDetails` (typed via `FinanceHonoModuleOptions` indexed access) and `netopiaCheckoutStarter` (`CheckoutPaymentStarter` — Netopia stays injected, never imported by the framework). Finance also reuses the already-relocated `resolveDocumentDownloadUrl`, `resolvePublicCheckoutBaseUrl`, and `resolveNotificationProviders` providers, confirming those shared fields satisfy multiple package option contracts.

  With finance done, all 21 standard `@voyant-travel/*` modules are framework-owned; only the standard extensions (Tier 3) and the `operator/*` lazy families (Tier 4) remain in the deployment registry.

- ba387e0: Relocate the **legal** module factory into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains the legal provider fields — `resolveDb`, `createOperatorDocumentStorage`, `resolveContractDocumentGenerator`, `createBookingPiiService`, `autoGenerateContractOnConfirmed` — each typed by `CreateLegalHonoModuleOptions` indexed access (drift-proof). All are `unknown`/`Record<string,unknown>`-bindings adapters, so the `OperatorCapabilities extends FrameworkProviders` guard passes cleanly.
- 54fc04a: Relocate the 6 pure singleton standard **extensions** into `frameworkComposition.extensions` (Workstream B, Tier 3a): bookings/booking-supplier, finance/bookings-create, inventory/booking, inventory/authoring, quotes/booking, and distribution (booking) extensions. These take no providers, so they move like the Tier 1 singletons; the deployment now spreads `...frameworkComposition.extensions`. The two injection-shaped extensions (distribution/channel-push, finance/booking-tax) remain in the deployment for Tier 3b.
- 4e5bb43: Relocate the 2 injection-shaped standard extensions into `frameworkComposition.extensions` (Workstream B, Tier 3b — completes Tier 3):

  - **finance/booking-tax** — `createBookingTaxHonoExtension` now lives in the framework factory; `FrameworkProviders` gains `resolveBookingTaxSettings` + `updateBookingTaxSettings` (typed via `BookingTaxRouteOptions`).
  - **distribution/channel-push** — its builder is genuinely deployment-wired (booking-engine registry), so it's injected as a `createChannelPushExtension: () => HonoExtension` provider; the framework owns the manifest entry while the deployment supplies the builder. This previews the Tier 4 injected-builder pattern.

  All standard `@voyant-travel/*` extensions are now framework-owned.

- a9fd30a: Relocate the 7 lazy `operator/*` standard module factories into `frameworkComposition.modules` (Workstream B, Tier 4a): flights, mcp, catalog-booking, catalog-content, media, payment-link, contract-document.

  The framework now owns each family's manifest entry **and its stable absolute route-path matchers** (the URL contract); the deployment injects only the `load` closure that wires its providers into the package-owned route bundle. `FrameworkProviders` gains 7 `LazyRoutesLoader` fields (`loadFlightAdminRoutes`, `loadMcpAdminRoutes`, `loadCatalogBookingRoutes`, `loadCatalogContentRoutes`, `loadMediaRoutes`, `loadPaymentLinkRoutes`, `loadContractDocumentRoutes`). `OPERATOR_RUNTIME_MANIFEST` is unchanged, preserving exact mount order. Only `operator/invitations` and `operator/operator-settings` remain in the deployment registry.

- 29086c7: Relocate the 7 lazy `operator/*` standard extension factories into `frameworkComposition.extensions` (Workstream B, Tier 4b — completes Tier 4): booking-schedule, quote-version-snapshot, booking-maintenance, action-ledger-health, proposal, catalog-offers, catalog-checkout.

  The framework owns each extension's `{ name, module }` metadata + `publicPath`; the deployment injects the builders/loaders. `FrameworkProviders` gains 8 fields — 2 `() => HonoExtension` builders (`createBookingScheduleExtension`, `createQuoteVersionSnapshotExtension`) and 6 `LazyRoutesLoader`s (`loadBookingMaintenanceRoutes`, `loadActionLedgerHealthRoutes`, `loadProposalAdminRoutes`, `loadProposalPublicRoutes`, `loadCatalogOffersRoutes`, `loadCatalogCheckoutRoutes`).

  The deployment's `operatorComposition.extensions` is now just `{ ...frameworkComposition.extensions }`. All standard modules **and** extensions are framework-owned; only `operator/invitations` + `operator/operator-settings` remain as deployment-local module factories (→ `extensions[]` at convergence).

- d45dd31: Collapse the booking-tax reader injection (Workstream B step 4, Stage 2a). The framework's `finance/booking-tax-extension` factory now reads `resolveBookingTaxSettings` / `updateBookingTaxSettings` straight from the standard `@voyant-travel/operator-settings` package instead of from injected providers.

  `FrameworkProviders` drops `resolveBookingTaxSettings` + `updateBookingTaxSettings`, and the operator deployment stops wiring them in `buildOperatorProviders`. This is the decided framework-layer wiring (open-question 2): no leaf module depends on operator-settings — only the framework assembly layer does (added as a dev + peer dependency, kept out of the BOM-locked `dependencies`). operator-settings stays `additionalSchemas`-only, so the runtime/BOM lockstep set is unchanged (16).

- cc82783: Promote `@voyant-travel/operator-settings` to a standard mounted module (Workstream B step 4, Stage 2b — completes the extraction).

  - The package gains a HonoModule: `./hono-module` (`createOperatorSettingsHonoModule()`, lazyRoutes at the stable absolute paths `/v1/admin/settings/*`, `/v1/public/operator-profile`, `/v1/public/settings/operator`) + `./routes` (the handlers). New deps: `@voyant-travel/hono` + `hono`.
  - It moves from `voyant.config` `additionalSchemas` → `modules`, so it joins the runtime/BOM **lockstep set (16 → 17)** and is added to the framework BOM `dependencies`. `FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition` own its factory.
  - The deployment drops `operator/operator-settings` from `deploymentLocalModules` (now only `invitations` remains) and **deletes** `src/api/routes/settings.ts` — the settings routes are package-owned.

  Migration parity holds (schema byte-identical, already in snapshot 0067; `additionalSchemas`→`modules` only changes the schema's position in the drizzle list, not its DDL). Composed module/extension counts are unchanged (29 / 34 / 15) — the module just moved framework-owned. `check-public-cache-policy` updated to the package's new routes path.

### Patch Changes

- Updated dependencies [04681f3]
- Updated dependencies [a3bd51c]
- Updated dependencies [170388e]
- Updated dependencies [e9d9dbb]
- Updated dependencies [9c3fe53]
- Updated dependencies [d29dd47]
- Updated dependencies [ce2a568]
- Updated dependencies [3aa90b4]
- Updated dependencies [39d48fe]
- Updated dependencies [9616f1f]
- Updated dependencies [d222e9f]
- Updated dependencies [6d75244]
- Updated dependencies [cc82783]
  - @voyant-travel/bookings@0.123.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/relationships@0.120.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/quotes@0.121.0
  - @voyant-travel/operator-settings@0.2.0
  - @voyant-travel/commerce@0.5.0
  - @voyant-travel/distribution@0.113.0
  - @voyant-travel/legal@0.123.0
  - @voyant-travel/notifications@0.112.0
  - @voyant-travel/storefront@0.124.0
  - @voyant-travel/trips@0.114.0
  - @voyant-travel/action-ledger@0.105.1
  - @voyant-travel/catalog@0.121.0
  - @voyant-travel/identity@0.123.0
  - @voyant-travel/inventory@0.3.3
  - @voyant-travel/operations@0.1.3
  - @voyant-travel/flights@0.123.0
