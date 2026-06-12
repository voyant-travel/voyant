# @voyantjs/travel-composer-react

## 0.110.0

### Patch Changes

- @voyantjs/catalog@0.117.0
- @voyantjs/finance@0.119.0
- @voyantjs/travel-composer@0.110.0
- @voyantjs/crm-react@0.119.0
- @voyantjs/ui@0.106.1
- @voyantjs/bookings-react@0.119.0
- @voyantjs/catalog-react@0.117.0
- @voyantjs/flights-react@0.119.0
- @voyantjs/flights@0.119.0

## 0.109.0

### Patch Changes

- @voyantjs/finance@0.118.0
- @voyantjs/bookings-react@0.118.0
- @voyantjs/catalog-react@0.116.0
- @voyantjs/flights-react@0.118.0
- @voyantjs/crm-react@0.118.0
- @voyantjs/catalog@0.116.0
- @voyantjs/flights@0.118.0
- @voyantjs/travel-composer@0.109.0

## 0.108.1

### Patch Changes

- Updated dependencies [b7056f1]
  - @voyantjs/finance@0.117.1
  - @voyantjs/catalog@0.115.1
  - @voyantjs/travel-composer@0.108.1
  - @voyantjs/flights@0.117.1
  - @voyantjs/bookings-react@0.117.1
  - @voyantjs/catalog-react@0.115.1
  - @voyantjs/crm-react@0.117.1
  - @voyantjs/flights-react@0.117.1

## 0.108.0

### Patch Changes

- Updated dependencies [7255353]
- Updated dependencies [7255353]
  - @voyantjs/catalog@0.115.0
  - @voyantjs/finance@0.117.0
  - @voyantjs/flights@0.117.0
  - @voyantjs/travel-composer@0.108.0
  - @voyantjs/bookings-react@0.117.0
  - @voyantjs/catalog-react@0.115.0
  - @voyantjs/crm-react@0.117.0
  - @voyantjs/flights-react@0.117.0

## 0.107.0

### Patch Changes

- @voyantjs/catalog@0.114.0
- @voyantjs/finance@0.116.0
- @voyantjs/travel-composer@0.107.0
- @voyantjs/flights@0.116.0
- @voyantjs/bookings-react@0.116.0
- @voyantjs/catalog-react@0.114.0
- @voyantjs/flights-react@0.116.0
- @voyantjs/crm-react@0.116.0

## 0.106.0

### Minor Changes

- 6d496d0: Add the `./admin` entry: `createTravelComposerAdminExtension` delivers the trips admin surface per the packaged-admin RFC — the Trips nav group (spliced after Bookings via `insertAfter`, with All trips / New trip sub-items and a host-supplied icon), the trips list (`TripsHost` with the filters popover), and the trip detail page whose Edit mode lazy-mounts the now-packaged admin trip composer (previously an operator-template component). Loaders are SSR `data-only` and seed the list/detail queries through the host runtime; routes carry `trip.list`/`trip.detail` destination annotations and all cross-route links resolve through semantic destinations (`booking.detail`, `person.detail`). The composer/page stack reads its API client from the shared provider context instead of app env helpers.

### Patch Changes

- Updated dependencies [41b08db]
  - @voyantjs/admin@0.111.0
  - @voyantjs/catalog-react@0.113.0
  - @voyantjs/bookings-react@0.115.0
  - @voyantjs/crm-react@0.115.0
  - @voyantjs/flights-react@0.115.0
  - @voyantjs/catalog@0.113.0
  - @voyantjs/finance@0.115.0
  - @voyantjs/flights@0.115.0
  - @voyantjs/travel-composer@0.106.0

## 0.105.8

### Patch Changes

- @voyantjs/travel-composer@0.105.8

## 0.105.7

### Patch Changes

- @voyantjs/travel-composer@0.105.7

## 0.105.6

### Patch Changes

- @voyantjs/travel-composer@0.105.6

## 0.105.5

### Patch Changes

- @voyantjs/travel-composer@0.105.5

## 0.105.4

### Patch Changes

- @voyantjs/travel-composer@0.105.4

## 0.105.3

### Patch Changes

- @voyantjs/travel-composer@0.105.3

## 0.105.2

### Patch Changes

- @voyantjs/travel-composer@0.105.2

## 0.105.1

### Patch Changes

- @voyantjs/travel-composer@0.105.1

## 0.105.0

### Minor Changes

- d1ad572: Add composer-owned Trip snapshot freezing and read APIs for Quote Version proposal snapshots.

### Patch Changes

- Updated dependencies [c2aef18]
- Updated dependencies [d1ad572]
  - @voyantjs/travel-composer@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/react@0.104.1
- @voyantjs/travel-composer@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/react@0.104.0
- @voyantjs/travel-composer@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/react@0.103.0
- @voyantjs/travel-composer@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/react@0.102.0
- @voyantjs/travel-composer@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/react@0.101.2
- @voyantjs/travel-composer@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/react@0.101.1
- @voyantjs/travel-composer@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/react@0.101.0
- @voyantjs/travel-composer@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/react@0.100.0
- @voyantjs/travel-composer@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/react@0.99.0
- @voyantjs/travel-composer@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/react@0.98.0
- @voyantjs/travel-composer@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/react@0.97.0
- @voyantjs/travel-composer@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/react@0.96.0
- @voyantjs/travel-composer@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/react@0.95.0
- @voyantjs/travel-composer@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/react@0.94.0
- @voyantjs/travel-composer@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/react@0.93.0
- @voyantjs/travel-composer@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/react@0.92.0
- @voyantjs/travel-composer@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/react@0.91.0
- @voyantjs/travel-composer@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/react@0.90.0
- @voyantjs/travel-composer@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/react@0.89.0
- @voyantjs/travel-composer@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/react@0.88.0
- @voyantjs/travel-composer@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/react@0.87.1
- @voyantjs/travel-composer@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/react@0.87.0
- @voyantjs/travel-composer@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/react@0.86.0
- @voyantjs/travel-composer@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/react@0.85.4
- @voyantjs/travel-composer@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/react@0.85.3
- @voyantjs/travel-composer@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/react@0.85.2
- @voyantjs/travel-composer@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/react@0.85.1
- @voyantjs/travel-composer@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/react@0.85.0
- @voyantjs/travel-composer@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/react@0.84.4
- @voyantjs/travel-composer@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/react@0.84.3
- @voyantjs/travel-composer@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/react@0.84.2
- @voyantjs/travel-composer@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/react@0.84.1
- @voyantjs/travel-composer@0.84.1

## 0.84.0

### Patch Changes

- 5462f07: Rename the remaining active trip composer stay filters from hospitality to accommodations and add a Cloudflare startup profile summary lane.
- Updated dependencies [5462f07]
  - @voyantjs/react@0.84.0
  - @voyantjs/travel-composer@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/react@0.83.1
- @voyantjs/travel-composer@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/react@0.83.0
- @voyantjs/travel-composer@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/react@0.82.1
- @voyantjs/travel-composer@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/react@0.82.0
- @voyantjs/travel-composer@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/react@0.81.21
- @voyantjs/travel-composer@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/react@0.81.20
- @voyantjs/travel-composer@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/react@0.81.19
- @voyantjs/travel-composer@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/react@0.81.18
- @voyantjs/travel-composer@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/react@0.81.17
- @voyantjs/travel-composer@0.81.17

## 0.81.16

### Patch Changes

- @voyantjs/react@0.81.16
- @voyantjs/travel-composer@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/react@0.81.15
- @voyantjs/travel-composer@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/react@0.81.14
- @voyantjs/travel-composer@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/react@0.81.13
- @voyantjs/travel-composer@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/react@0.81.12
- @voyantjs/travel-composer@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/react@0.81.11
- @voyantjs/travel-composer@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/react@0.81.10
- @voyantjs/travel-composer@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/react@0.81.9
- @voyantjs/travel-composer@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/react@0.81.8
- @voyantjs/travel-composer@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/react@0.81.7
- @voyantjs/travel-composer@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/react@0.81.6
- @voyantjs/travel-composer@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/react@0.81.5
- @voyantjs/travel-composer@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/react@0.81.4
- @voyantjs/travel-composer@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/react@0.81.3
- @voyantjs/travel-composer@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/react@0.81.2
- @voyantjs/travel-composer@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/react@0.81.1
- @voyantjs/travel-composer@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/react@0.81.0
- @voyantjs/travel-composer@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/react@0.80.18
- @voyantjs/travel-composer@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/react@0.80.17
- @voyantjs/travel-composer@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/react@0.80.16
- @voyantjs/travel-composer@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/react@0.80.15
- @voyantjs/travel-composer@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/react@0.80.14
- @voyantjs/travel-composer@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/react@0.80.13
- @voyantjs/travel-composer@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/react@0.80.12
- @voyantjs/travel-composer@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/react@0.80.11
- @voyantjs/travel-composer@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/react@0.80.10
- @voyantjs/travel-composer@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/react@0.80.9
- @voyantjs/travel-composer@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/react@0.80.8
- @voyantjs/travel-composer@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/react@0.80.7
- @voyantjs/travel-composer@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/react@0.80.6
- @voyantjs/travel-composer@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/react@0.80.5
- @voyantjs/travel-composer@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/react@0.80.4
- @voyantjs/travel-composer@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/react@0.80.3
- @voyantjs/travel-composer@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/react@0.80.2
- @voyantjs/travel-composer@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/react@0.80.1
- @voyantjs/travel-composer@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/react@0.80.0
- @voyantjs/travel-composer@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/react@0.79.0
- @voyantjs/travel-composer@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/react@0.78.0
- @voyantjs/travel-composer@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/react@0.77.13
- @voyantjs/travel-composer@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/react@0.77.12
- @voyantjs/travel-composer@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/react@0.77.11
- @voyantjs/travel-composer@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/react@0.77.10
- @voyantjs/travel-composer@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/react@0.77.9
- @voyantjs/travel-composer@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/react@0.77.8
- @voyantjs/travel-composer@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/react@0.77.7
- @voyantjs/travel-composer@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/react@0.77.6
- @voyantjs/travel-composer@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/react@0.77.5
- @voyantjs/travel-composer@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/react@0.77.4
- @voyantjs/travel-composer@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/react@0.77.3
- @voyantjs/travel-composer@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/react@0.77.2
- @voyantjs/travel-composer@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/react@0.77.1
- @voyantjs/travel-composer@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/react@0.77.0
- @voyantjs/travel-composer@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/react@0.76.0
- @voyantjs/travel-composer@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/react@0.75.7
- @voyantjs/travel-composer@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/react@0.75.6
- @voyantjs/travel-composer@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/react@0.75.5
- @voyantjs/travel-composer@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/react@0.75.4
- @voyantjs/travel-composer@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/react@0.75.3
- @voyantjs/travel-composer@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/react@0.75.2
- @voyantjs/travel-composer@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/react@0.75.1
- @voyantjs/travel-composer@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/react@0.75.0
- @voyantjs/travel-composer@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/react@0.74.2
- @voyantjs/travel-composer@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/react@0.74.1
- @voyantjs/travel-composer@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/react@0.74.0
- @voyantjs/travel-composer@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/react@0.73.1
- @voyantjs/travel-composer@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/react@0.73.0
- @voyantjs/travel-composer@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/react@0.72.0
- @voyantjs/travel-composer@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/react@0.71.0
- @voyantjs/travel-composer@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/react@0.70.0
- @voyantjs/travel-composer@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/react@0.69.1
- @voyantjs/travel-composer@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/react@0.69.0
- @voyantjs/travel-composer@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/react@0.68.0
- @voyantjs/travel-composer@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/react@0.67.0
- @voyantjs/travel-composer@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/react@0.66.6
- @voyantjs/travel-composer@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/react@0.66.5
- @voyantjs/travel-composer@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/react@0.66.4
- @voyantjs/travel-composer@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/react@0.66.3
- @voyantjs/travel-composer@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/react@0.66.2
- @voyantjs/travel-composer@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/react@0.66.1
- @voyantjs/travel-composer@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/react@0.66.0
- @voyantjs/travel-composer@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/react@0.65.0
- @voyantjs/travel-composer@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/react@0.64.1
- @voyantjs/travel-composer@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/react@0.64.0
- @voyantjs/travel-composer@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/react@0.63.1
- @voyantjs/travel-composer@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/react@0.63.0
- @voyantjs/travel-composer@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/react@0.62.3
- @voyantjs/travel-composer@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/react@0.62.2
- @voyantjs/travel-composer@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/react@0.62.1
- @voyantjs/travel-composer@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/react@0.62.0
- @voyantjs/travel-composer@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/react@0.61.0
- @voyantjs/travel-composer@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/react@0.60.0
- @voyantjs/travel-composer@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/react@0.59.0
- @voyantjs/travel-composer@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/react@0.58.0
- @voyantjs/travel-composer@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/react@0.57.0
- @voyantjs/travel-composer@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/react@0.56.0
- @voyantjs/travel-composer@0.56.0

## 0.55.1

### Patch Changes

- 819c847: Add the Travel Composer foundation for customer-facing composed trips.

  `@voyantjs/travel-composer` introduces Trip Envelopes and Trip Components,
  durable schema, Zod contracts, deterministic draft/component operations,
  catalog-backed component adaptation, aggregate price and tax snapshots, reserve
  and checkout handoff workflows, component-level cancellation preview/cancel
  operations, Cruise Extension representation helpers, admin/public Hono routes,
  and AI-safe itinerary MCP tools.

  `@voyantjs/travel-composer-react` adds the matching React client layer:
  admin/public operation helpers, validation-aware fetches, cache writers, query
  keys/options, provider wiring, and hooks for draft, component, pricing,
  reserve, checkout, and cancellation flows.

- Updated dependencies [819c847]
  - @voyantjs/react@0.55.1
  - @voyantjs/travel-composer@0.55.1
