---
"@voyantjs/admin": patch
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/bookings-ui": patch
---

Booking detail / list overhaul, part 2:

**Activity tab**
- Notes moved to the top, redesigned as a card grid (no more table). Add/edit via a new `BookingNoteDialog`; delete via `AlertDialog`. New backend endpoint `PATCH /v1/bookings/:id/notes/:noteId` + `bookingsService.updateNote` + `updateBookingNoteSchema` + `update` mutation on `useBookingNoteMutation`.
- Activity timeline refactored to match the section-header pattern (no `Card` wrapper, `h2` + `Activity` icon + filter chips). Accepts `additionalEvents` + `footer` so action-ledger entries merge into the same chronological feed. New `action` filter chip surfaces only when ledger events are present.
- Notes + activity entries now expose hydrated `authorName` / `actorName` (+ email fallback) via a server-side `LEFT JOIN auth.user` in `listNotes` / `listActivity`. UI renders name → email → id.
- Client-side pagination on the timeline using the design-system `Pagination` / `PaginationLink` / `PaginationNext` primitives. Default page size 10, resets to page 1 on filter change.

**Ledger tab removed** — entries flow into the unified Activity timeline via the new `useBookingActionLedgerEvents` hook (operator template), which keeps the cursor-based "Load more" pager rendered as the timeline's `footer`. `ledgerTab` slot + `tabLedger` i18n key dropped.

**Metadata tab**
- Tab renamed from "Meta" → "Metadata" (`tabMetadata`, value `metadata`).
- Content redesigned as a definition-list of label-left / value-right rows surfacing booking id, booking number, status, communication language, created, updated. Uses the same `h2` + `Info` icon header as the rest.

**Tab URL state**
- `BookingDetailPage` accepts `activeTab` + `onTabChange` props (typed via new exported `BookingDetailTabValue`). Operator route wires these to a `tab` enum on its `validateSearch` schema. Refreshing or sharing `/bookings/:id?tab=activity` lands on the right tab.
- Renamed `overview` tab value → `items` to match the (already-shipped) label.

**Bookings list filters in URL**
- New exported `BookingListFiltersState` shape. `BookingList` + `BookingsPage` accept `initialFilters?: Partial<BookingListFiltersState>` + `onFiltersChange?: (filters) => void`. Internal state collapsed into a single state object; every change emits a snapshot.
- Operator route wires it through `validateSearch` (status, ids, dates, pax, sort, offset). URL stays clean: defaults are stripped before push, `navigate({ replace: true })` avoids history churn.
- Bug fix: stripping `undefined` from the partial initial filters so an empty `/bookings` URL no longer clobbers the `BOOKING_STATUS_ALL` default and shows a phantom "Filters 2" badge on first land.

**Bookings list table polish**
- Columns reordered: `Booking # → Created → Payer → Items → Status → Total → Pax → Dates`.
- `Sell amount` renamed to `Total`; `Start date/time` → `Dates`; `Lead` → `Payer`; search placeholder advertises what's matched (`"Search by booking #, payer, email, phone, or item…"`).
- Backend search additionally matches item title + product-name snapshot (`exists (select 1 from booking_items …)`).
- New compact, locale-aware `formatBookingDateRange` collapses shared month/year — `"Jun 15 – 20, 2026"` in en, `"15 – 20 iun., 2026"` in ro (uses `Intl.DateTimeFormat.formatToParts` to detect day-first order). Avoids the `Intl` `{day,year}` nonsense output by always building from named parts.
- Primary item label includes a muted `({count} days)` tag computed from `startsAt` / `endsAt` (added to `bookingRecordItemSummarySchema` + server projection).
- Hand-rolled prev/next pagination replaced with the design-system `Pagination` primitives (`BookingListPagination`), with ellipsis-windowed page numbers via `computePageWindow`.

**Admin sidebar (`@voyantjs/admin`)**
- `DefaultOperatorAdminBrand` adds `group-data-[collapsible=icon]:justify-center` so the brand mark centres correctly when the sidebar is collapsed to icon-only.
