---
"@voyantjs/products-ui": patch
"@voyantjs/ui": patch
---

Consolidate the operator's forked product-detail page into `@voyantjs/products-ui` as the canonical, app-agnostic `ProductDetailPage`.

- `@voyantjs/products-ui`: new `components/product-detail` module — the full product-detail page (details, in-context translations, itinerary + day sheet, options/pricing, media, departures, schedules, channels, organize, brochure, market rules, payment policy, extras, activity) plus a `ProductDetailHostProvider` that injects everything app-specific (messages, REST client, locale, navigation callbacks, media upload, breadcrumbs, an option-extras slot). Templates mount the page by supplying the host instead of forking it.
- `@voyantjs/ui`: `DatePicker`/`DateRangePicker` triggers now forward base-ui's `PopoverTrigger` props so the calendar popover opens on click (fixes a regression where clicking the trigger did nothing).
