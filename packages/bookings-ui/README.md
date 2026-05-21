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

- `BookingsPage`, `BookingDetailPage`
- `BookingList`, `BookingDialog`, `BookingCreateDialog`, `BookingCancellationDialog`, `StatusChangeDialog`
- `TravelerList`, `TravelerDialog`, `BookingItemList`, `BookingGroupSection`
- `BookingPaymentsSummary`, `BookingPaymentScheduleList`, `BookingGuaranteeList`
- `SupplierStatusList`, `BookingActivityTimeline`, `BookingNotes`

`BookingDetailPage` is the canonical multi-tab booking surface (Overview,
Travelers, Payments, Suppliers, Documents, Activity, plus optional `Invoices`
and `Ledger` tabs). Templates inject template-owned cards via the `slots`
prop and wire router navigation through `onBack`, `onPersonOpen`,
`onOrganizationOpen`, `onCollectPayment`, and `onRecordPayment` callbacks:

```tsx
<BookingDetailPage
  id={bookingId}
  hideBreadcrumb
  onBack={() => router.push("/bookings")}
  onPersonOpen={(personId) => router.push(`/people/${personId}`)}
  onCollectPayment={() => setCollectOpen(true)}
  onRecordPayment={() => setRecordOpen(true)}
  slots={{
    header: (booking) => <WidgetSlot slot="booking.header" props={{ booking }} />,
    overviewStart: () => <CatalogSourceCard bookingId={bookingId} />,
    financeStart: () => <PendingPaymentSessions bookingId={bookingId} />,
    invoicesTab: { content: (booking) => <InvoicesCard booking={booking} /> },
    ledgerTab: { content: <ActionLedgerPanel bookingId={bookingId} /> },
    documents: () => <DocumentsTable bookingId={bookingId} />,
  }}
/>
```

## I18n

Components render English by default. To localize them, wrap your UI in
`BookingsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui"
import { bookingsUiEn } from "@voyantjs/bookings-ui/i18n/en"
import { bookingsUiRo } from "@voyantjs/bookings-ui/i18n/ro"
```
