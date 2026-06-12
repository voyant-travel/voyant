---
"@voyantjs/flights-react": minor
"@voyantjs/distribution-react": minor
"@voyantjs/finance-react": minor
---

Three more operator surfaces become package-delivered admin contributions (packaged-admin RFC §4.8):

- `@voyantjs/flights-react/admin` (new entry): `createFlightsAdminExtension` ships the flight search page and the booking wizard as full route contributions — package-owned search contracts (`flightsIndexSearchSchema`, `flightsBookSearchSchema`), lazy page modules, and semantic destinations (`flight.search` route-backed; `flightBooking.start` declared for the host's hand-written resolver; post-booking lands on the shared `booking.detail`). The wizard mounts as a flat sibling of the search route, reproducing the old file-based `flights_.book` section-chrome escape exactly.
- `@voyantjs/distribution-react/admin` (new entry): `createDistributionAdminExtension` ships the channel-sync page as a lazy route contribution; the page reads `baseUrl` + credentialed fetcher from the shared provider context, so the host needs no props and no route file.
- `@voyantjs/finance-react/admin`: the two supplier-invoices contributions graduate from metadata-only to full implementations. The previously app-owned wiring travels package-side: attachment uploads post to the template-level `/v1/uploads` through the finance provider context (the `BookingInvoicesWidget` precedent), inline supplier creation rides `useSupplierMutation().create` from `@voyantjs/suppliers-react`, and the allocation dialog's cross-domain target search composes `getProductsQueryOptions` / `getBookingsQueryOptions` / `getSlotsQueryOptions` through the same context client (new optional peers: `@voyantjs/products-react`, `@voyantjs/availability-react`). New route-backed destinations: `supplierInvoice.list`, `supplierInvoice.detail`.
