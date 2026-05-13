# @voyantjs/admin

## 0.37.1

### Patch Changes

- @voyantjs/i18n@0.37.1
- @voyantjs/react@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Patch Changes

- 712a441: Add an operator admin page shell with breadcrumb, action, sidebar trigger, and padded content slots.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/i18n@0.37.0
  - @voyantjs/react@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/i18n@0.36.0
- @voyantjs/react@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/i18n@0.35.0
  - @voyantjs/react@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Minor Changes

- 74f0331: Add locale-aware admin page metadata helpers and derive workspace titles from navigation.
- 6ad175a: Add dashboard empty states, KPI empty hints, and localized first-run onboarding copy.

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/i18n@0.34.0
  - @voyantjs/react@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/i18n@0.33.1
- @voyantjs/react@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/i18n@0.33.0
  - @voyantjs/react@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/i18n@0.32.3
  - @voyantjs/react@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- 778d35e: Align OperatorAdminWorkspaceLayout with the shadcn sidebar composition by using SidebarInset, exposing sidebar variant controls, adding a visible sidebar trigger, and shaping the default brand as a SidebarMenuButton.
- c1de5a1: Ship reusable Voyant mark and wordmark SVG components and use them in the default operator admin sidebar brand.
  - @voyantjs/i18n@0.32.2
  - @voyantjs/react@0.32.2
  - @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/i18n@0.32.1
- @voyantjs/react@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/i18n@0.32.0
- @voyantjs/react@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/i18n@0.31.4
- @voyantjs/react@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/i18n@0.31.3
- @voyantjs/react@0.31.3
- @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/i18n@0.31.2
  - @voyantjs/react@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/i18n@0.31.1
  - @voyantjs/react@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish the operator dashboard page composition, dashboard skeletons, and aggregate query helpers from `@voyantjs/admin`.
- ee75afb: Publish reusable TaxesPage and TeamSettingsPage settings compositions from their owning UI packages.

### Patch Changes

- @voyantjs/i18n@0.31.0
- @voyantjs/react@0.31.0
- @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/i18n@0.30.7
- @voyantjs/react@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/i18n@0.30.6
- @voyantjs/react@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/i18n@0.30.5
- @voyantjs/react@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/i18n@0.30.4
- @voyantjs/react@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/i18n@0.30.3
- @voyantjs/react@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/i18n@0.30.2
- @voyantjs/react@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/i18n@0.30.1
- @voyantjs/react@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/i18n@0.30.0
- @voyantjs/react@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- 4a6523e: Reminder sequences UI (#488).

  New `@voyantjs/notifications-ui` package with the reminder-sequence editing surface:

  - `<StageList />` — ordered stages per rule, with reorder + delete and an embedded channel list.
  - `<StageEditorDialog />` — anchor / window / cadence (`once` | `every_n_days` | `escalating(buckets[])`) / `maxSendsInStage` / `respectQuietHours`.
  - `<StageChannelList />` + `<StageChannelEditorDialog />` — per-stage multi-channel rows (channel, template, recipient kind, optional role).
  - `<NotificationSettingsForm />` — quiet hours / blackout dates / weekend skip / recipient daily cap / suppression window.
  - `<RemindersPreviewList />` — read-only "what would fire on this date" table with reasoning per row.
  - Full en/ro i18n with `NotificationsUiMessagesProvider`.

  Hooks added to `@voyantjs/notifications-react`:

  - `useReminderRuleStages`, `useReminderRuleStageMutation` (create, update, delete, reorder)
  - `useReminderStageChannels`, `useReminderStageChannelMutation`
  - `useNotificationSettings`, `useNotificationSettingsMutation`
  - `useRemindersPreview`

  Operator template wires up three new routes (`/notifications/reminder-rules/:id`, `/notifications/preview`, `/notifications/settings`) and the operator nav gains Preview + Settings entries.

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/i18n@0.29.0
  - @voyantjs/react@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- 60ef432: Add a unified payments listing that joins customer and supplier payments into a single feed, and split the operator finance area into separate Invoices and Payments pages.

  `@voyantjs/finance`:

  - New routes `GET /v1/admin/finance/payments` and `GET /v1/admin/finance/payments/:id`. The list endpoint accepts a `kind` filter (`customer` | `supplier`) plus the usual `status` / `paymentMethod` / `currency` / `invoiceId` / `bookingId` / `supplierId` / `paymentDateFrom` / `paymentDateTo` / `search` filters and `sortBy` (`amountCents` | `status` | `paymentDate` | `createdAt`) / `sortDir`. The detail endpoint dispatches by typeid prefix — `pay_*` resolves to a customer payment, `spay_*` resolves to a supplier payment. `bookingId` is applied to both branches: directly to `supplier_payments.booking_id` on the supplier side and via `invoices.booking_id` (joined as `i`) on the customer side, so a booking-scoped query no longer returns unrelated customer rows.
  - `financeService.listAllPayments(db, query)` and `financeService.getPaymentById(db, id)` return a `UnifiedPaymentRow` shape with normalized fields (`personName`, `organizationName`, `supplierName`, `invoiceNumber`, `bookingNumber`) joined in via SQL so the operator UI doesn't need follow-up lookups.
  - New exports: `UnifiedPaymentRow` (service.ts) and `paymentKindSchema` / `paymentListQuerySchema` / `paymentListSortFieldSchema` / `paymentListSortDirSchema` (validation-payments.ts).

  `@voyantjs/finance-react`:

  - New hooks: `useAllPayments(filters)` and `usePayment(id)` plus the underlying `getAllPaymentsQueryOptions` / `getPaymentQueryOptions` query-options factories.
  - New types: `FinancePaymentKind`, `FinanceAllPaymentsListFilters`, `FinanceAllPaymentsListSortField`, `FinanceAllPaymentsListSortDir`.
  - New schemas: `paymentKindSchema`, `unifiedPaymentRecordSchema`, `allPaymentsListResponse`, `paymentSingleResponse`, plus matching `UnifiedPaymentRecord` type.
  - New invoice-payment-mutation invalidation now also invalidates `financeQueryKeys.allPayments()` so the unified feed stays in sync with single-invoice payment flows.

  `@voyantjs/admin`:

  - Operator nav `finance` entry now points at `/finance/invoices` and exposes an `items` sub-nav with `invoices` and `payments` links, matching the new operator page split.

  `@voyantjs/i18n`:

  - Operator nav messages add `invoices` and `payments` (en + ro).
  - Admin finance messages add `invoicesPageTitle`/`invoicesPageDescription`, `paymentsPageTitle`/`paymentsPageDescription`, `recordPayment`, `searchPaymentsPlaceholder`, `kindColumn`/`kindCustomer`/`kindSupplier`/`partyColumn`/`filtersKindLabel`/`filtersKindAll`, plus the `paymentDetail` and `recordPaymentDialog` message groups (en + ro).

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/i18n@0.28.3
  - @voyantjs/react@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/i18n@0.28.2
- @voyantjs/react@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/i18n@0.28.1
  - @voyantjs/react@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/i18n@0.28.0
- @voyantjs/react@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/i18n@0.27.0
  - @voyantjs/react@0.27.0
  - @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/i18n@0.26.9
  - @voyantjs/react@0.26.9
  - @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/i18n@0.26.8
- @voyantjs/react@0.26.8
- @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/i18n@0.26.7
- @voyantjs/react@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/i18n@0.26.6
- @voyantjs/react@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/i18n@0.26.5
- @voyantjs/react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/i18n@0.26.4
- @voyantjs/react@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/i18n@0.26.3
- @voyantjs/react@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/i18n@0.26.2
- @voyantjs/react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/i18n@0.26.1
- @voyantjs/react@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/i18n@0.26.0
- @voyantjs/react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/i18n@0.25.0
- @voyantjs/react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- c112761: Add a single-tenant-first operator admin bootstrap gate and update first-party
  templates to render authenticated shells from current-user readiness instead of
  workspace or organization bootstrap state.
  - @voyantjs/i18n@0.24.3
  - @voyantjs/react@0.24.3
  - @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/i18n@0.24.2
- @voyantjs/react@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
- Updated dependencies [ed635c7]
  - @voyantjs/i18n@0.24.1
  - @voyantjs/react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/i18n@0.24.0
- @voyantjs/react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/i18n@0.23.0
- @voyantjs/react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Minor Changes

- 930ec96: Package reusable operator admin shell composition and availability UI surfaces.

  `@voyantjs/admin` now exports reusable operator shell providers, navigation helpers, sidebar/workspace layout components, widget slot rendering, locale preference sync, and operator message provider utilities.

  `@voyantjs/availability-ui` now provides reusable availability overview, tab panels, dialogs with app-owned mutation adapters, table column builders, status helpers, loading skeletons, section headers, and selection-label formatting for operator apps.

### Patch Changes

- @voyantjs/i18n@0.22.0
- @voyantjs/react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/i18n@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/i18n@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/i18n@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/i18n@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/i18n@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Published `@voyantjs/admin` (renamed from the previously-private `@voyantjs/voyant-admin`). The redundant scope/prefix was inconsistent with the rest of the workspace (`@voyantjs/auth`, `@voyantjs/crm`, …). Templates that referenced `@voyantjs/voyant-admin` as `workspace:*` now use `@voyantjs/admin` and resolve to the published package on scaffold.

  Includes the full publish setup: `tsconfig.build.json`, `build` / `prepack` scripts, `files: ["dist"]`, `publishConfig.exports` for all 9 subpaths (`.`, `./extensions`, `./providers/{theme,locale,query-client,admin-provider}`, `./lib/{i18n,initials}`, `./types`).

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/i18n@0.17.0
