# @voyantjs/catalog-ui

Reusable catalog UI primitives and page-level compositions.

## Page Compositions

`CatalogPage` owns the tabbed catalog search layout and default vertical columns.
Apps provide routing and deployment-specific behavior through callbacks:

- `search`, `onTabChange`, `onQueryChange`, and `onPageChange` for URL state.
- `formatSupplier` for supplier id labels.
- `onBookHit`, `onBookDeparture`, `onOpenProductEditor`, and
  `onLoadProductDetail` for route transitions and content APIs.
- `detailSheetWidth`, `detailHeaderExtras`, `renderDetailBrochure`,
  `renderDetailMedia`, `renderDetailItineraryDay`, and
  `renderDetailExtraSections` for consumer-specific catalog detail sections
  such as brochure downloads, print actions, provenance cards, and richer
  media or itinerary layouts.

`CatalogBookingPage` owns the quote-to-book form. Apps pass the route state plus
`fetchers`, typically from `createCatalogBookingFetchers({ baseUrl })`, and may
slot in their own contact picker via `renderContactPicker`.

## I18n

The package exports `CatalogUiMessagesProvider`, `catalogUiEn`, and
`catalogUiRo` from `@voyantjs/catalog-ui/i18n`. Components fall back to English
when no provider is mounted.
