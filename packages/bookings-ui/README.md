# @voyantjs/bookings-ui

Importable React UI components for Voyant bookings. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/bookings-ui @voyantjs/bookings-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/bookings-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

## Components

- `BookingsPage`, `BookingDetailPage`, `BookingWorkspacePage`
- `BookingList`, `BookingDialog`, `BookingCreateDialog`, `BookingCancellationDialog`, `StatusChangeDialog`
- `TravelerList`, `TravelerDialog`, `BookingItemList`, `BookingGroupSection`
- `BookingPaymentsSummary`, `BookingPaymentScheduleList`, `BookingGuaranteeList`
- `SupplierStatusList`, `BookingActivityTimeline`, `BookingNotes`

`BookingWorkspacePage` wraps the existing `BookingDetailPage` in a reusable
operator workspace shell. It publishes cross-module navigation for booking,
finance, legal, travelers, and activity work while keeping module-specific
surfaces app-owned through typed slots:

```tsx
<BookingWorkspacePage
  id={bookingId}
  slots={{
    actionBar: ({ booking }) => <button type="button">Assign {booking.bookingNumber}</button>,
    bookingTab: ({ booking }) => <BookingOverviewPanel booking={booking} />,
    financeSidebar: ({ bookingId }) => <FinanceStatusCard bookingId={bookingId} />,
    legalTab: ({ bookingId }) => <ContractChecklist bookingId={bookingId} />,
    travelersTabExtensions: ({ bulkActions }) => (
      <BatchTravelerTools selectedTravelerIds={bulkActions.selectedTravelerIds} />
    ),
    activityTab: ({ bookingId }) => <OperatorTimeline bookingId={bookingId} />,
  }}
/>
```

Slot render functions receive the booking, active workspace section, section
setter, and bulk-action state for traveler and finance selections. Use
`bookingTab` when an app wants to use top-level finance, legal, traveler, or
activity tabs without nesting the default `BookingDetailPage` tabs. When
`bookingTab` is omitted, the workspace keeps mounting `BookingDetailPage`; use
`bookingDetailSlots` to pass slots through to that default detail page.

## I18n

Components render English by default. To localize them, wrap your UI in
`BookingsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui"
import { bookingsUiEn } from "@voyantjs/bookings-ui/i18n/en"
import { bookingsUiRo } from "@voyantjs/bookings-ui/i18n/ro"
```
