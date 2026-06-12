---
"@voyantjs/travel-composer-react": minor
---

Add the `./admin` entry: `createTravelComposerAdminExtension` delivers the trips admin surface per the packaged-admin RFC — the Trips nav group (spliced after Bookings via `insertAfter`, with All trips / New trip sub-items and a host-supplied icon), the trips list (`TripsHost` with the filters popover), and the trip detail page whose Edit mode lazy-mounts the now-packaged admin trip composer (previously an operator-template component). Loaders are SSR `data-only` and seed the list/detail queries through the host runtime; routes carry `trip.list`/`trip.detail` destination annotations and all cross-route links resolve through semantic destinations (`booking.detail`, `person.detail`). The composer/page stack reads its API client from the shared provider context instead of app env helpers.
