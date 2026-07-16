import { describe, expect, it } from "vitest"
import { createFinanceVoyantRuntime } from "../../src/index.js"
import {
  financeBookingScheduleVoyantPlugin,
  financeBookingsCreateVoyantPlugin,
  financeBookingTaxVoyantPlugin,
  financeVoyantModule,
} from "../../src/voyant.js"

describe("finance deployment manifest", () => {
  it("owns the module deployment surfaces", () => {
    expect(financeVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/finance",
      packageName: "@voyant-travel/finance",
      provides: {
        capabilities: ["finance.data-owner", "finance.payment-sessions"],
        ports: [
          { id: "action-ledger.finance-drift-runtime" },
          { id: "bookings.finance.runtime" },
          { id: "finance.host.runtime" },
        ],
      },
      runtime: { entry: "@voyant-travel/finance", export: "createFinanceVoyantRuntime" },
      runtimePorts: [
        { id: "finance.host.runtime" },
        { id: "custom-fields.runtime" },
        { id: "finance.notifications.runtime" },
        { id: "finance.checkout-payment-starters.runtime", optional: true },
        { id: "finance.invoice-settlement-poller", optional: true, cardinality: "many" },
      ],
      api: [
        {
          id: "@voyant-travel/finance#api.admin",
          surface: "admin",
          openapi: { document: "finance" },
          runtime: { entry: "@voyant-travel/finance", export: "createFinanceApiModule" },
        },
        {
          id: "@voyant-travel/finance#api.public",
          surface: "public",
          openapi: { document: "finance" },
          anonymous: [
            "/bookings",
            "/collections",
            "/payment-sessions",
            "/accountant",
            "/travel-credits",
          ],
          runtime: { entry: "@voyant-travel/finance", export: "createFinanceApiModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/finance#schema" }],
      migrations: [{ id: "@voyant-travel/finance#migrations" }],
      setupMigrations: [
        {
          id: "@voyant-travel/finance#setup.vouchers-from-payment-instruments.v1",
          runtime: {
            entry: "@voyant-travel/finance/setup/travel-credits",
            export: "runTravelCreditSetupMigration",
          },
          dependsOn: ["@voyant-travel/finance#migrations"],
        },
      ],
      links: [
        { id: "@voyant-travel/finance#linkable.creditNote" },
        { id: "@voyant-travel/finance#linkable.invoice" },
        { id: "@voyant-travel/finance#linkable.invoiceTemplate" },
        { id: "@voyant-travel/finance#linkable.supplierInvoice" },
      ],
      presentations: [
        {
          id: "@voyant-travel/finance#presentation.public",
          runtime: {
            entry: "@voyant-travel/finance-react/public-routes",
            export: "createFinancePublicRouteContribution",
          },
        },
      ],
    })
    expectConcreteEventSchemas(financeVoyantModule.events)
  })

  it("declares Finance access and destructive tool authority", () => {
    expect(financeVoyantModule.access?.resources?.map((resource) => resource.resource)).toEqual([
      "finance",
    ])
    expect(financeVoyantModule.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "list_invoices", risk: "low" }),
        expect.objectContaining({ name: "get_invoice", risk: "low" }),
        expect.objectContaining({ name: "void_invoice", risk: "critical" }),
        expect.objectContaining({ name: "issue_invoice_refund", risk: "critical" }),
        expect.objectContaining({ name: "issue_invoice_from_booking", risk: "high" }),
      ]),
    )
    expect(financeVoyantModule.actions).toContainEqual(
      expect.objectContaining({
        id: "@voyant-travel/finance#action.issue-invoice-refund",
        requiredScopes: ["finance:refund"],
        risk: "critical",
        ledger: "required",
        approval: "required",
        reversible: false,
        from: { tools: ["@voyant-travel/finance#tool.issue-invoice-refund"] },
      }),
    )
    expect(financeVoyantModule.actions).toContainEqual(
      expect.objectContaining({
        id: "@voyant-travel/finance#action.issue-invoice-from-booking",
        requiredScopes: ["finance:write", "bookings:read"],
        ledger: "required",
        approval: "required",
      }),
    )
    expect(financeVoyantModule.actions).toContainEqual(
      expect.objectContaining({
        id: "@voyant-travel/finance#action.void-invoice",
        requiredScopes: ["finance:void"],
        risk: "critical",
        ledger: "required",
        approval: "required",
        from: { tools: ["@voyant-travel/finance#tool.void-invoice"] },
      }),
    )
  })

  it("mounts only selected Finance API surfaces", async () => {
    const runtime = await createFinanceVoyantRuntime({
      unitId: "@voyant-travel/finance",
      projectConfig: {},
      getUnitProjectConfig: () => undefined,
      api: [{ id: "finance.admin", surface: "admin" }],
      hasPort: () => true,
      getPort: async <TProvider>(port: { id: string }) => {
        const providers: Record<string, unknown> = {
          "finance.host.runtime": {
            primitives: {
              env: () => ({}),
              storage: { downloadUrl: () => undefined },
            },
          },
          "custom-fields.runtime": {
            resolveRegistry: async () => ({
              all: () => [],
              entities: () => [],
              field: () => undefined,
              forEntity: () => [],
            }),
            resolveRegistryForWrite: async () => ({
              all: () => [],
              entities: () => [],
              field: () => undefined,
              forEntity: () => [],
            }),
            resolveVisibleValues: async () => ({}),
          },
          "finance.notifications.runtime": {
            resolveNotificationDispatcher: () => undefined,
            listBookingReminderRuns: async () => [],
          },
          "finance.checkout-payment-starters.runtime": { resolvePaymentStarters: () => ({}) },
        }
        return providers[port.id] as TProvider
      },
      getPorts: async <TProvider>() => [] as TProvider[],
    } as never)

    expect(runtime.adminRoutes).toBeDefined()
    expect(runtime.publicRoutes).toBeUndefined()
  })

  it("owns the finance extensions", () => {
    expect([financeBookingTaxVoyantPlugin, financeBookingsCreateVoyantPlugin]).toMatchObject([
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/finance#booking-tax-extension",
        runtime: { entry: "@voyant-travel/finance", export: "createBookingTaxVoyantRuntime" },
        runtimePorts: [{ id: "finance.operator-settings.runtime" }],
        api: [
          {
            id: "@voyant-travel/finance#booking-tax-extension.api",
            surface: "admin",
            mount: "bookings",
            openapi: { document: "booking-tax" },
            runtime: {
              entry: "@voyant-travel/finance",
              export: "createBookingTaxApiExtension",
            },
          },
        ],
      },
      {
        schemaVersion: "voyant.extension.v1",
        id: "@voyant-travel/finance#bookings-create-extension",
        api: [
          {
            id: "@voyant-travel/finance#bookings-create-extension.api",
            surface: "admin",
            mount: "bookings",
            openapi: { document: "bookings" },
            runtime: { entry: "@voyant-travel/finance", export: "bookingsCreateExtension" },
          },
        ],
        tools: [
          expect.objectContaining({
            id: "@voyant-travel/finance#bookings-create-extension.tool.create-booking",
            name: "create_booking",
          }),
        ],
        actions: [
          expect.objectContaining({
            id: "@voyant-travel/finance#bookings-create-extension.action.create-booking",
            ledger: "required",
          }),
        ],
      },
    ])
  })

  it("owns the booking schedule bridge with package runtime references", () => {
    expect(financeBookingScheduleVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/finance#booking-schedule-extension",
      packageName: "@voyant-travel/finance",
      runtime: {
        entry: "@voyant-travel/finance",
        export: "createBookingScheduleVoyantRuntime",
      },
      runtimePorts: [
        { id: "finance.host.runtime" },
        { id: "finance.operator-settings.runtime" },
        { id: "finance.distribution-payment-policy.runtime" },
        { id: "finance.accommodations-payment-policy.runtime" },
        { id: "finance.cruises-payment-policy.runtime" },
        { id: "finance.inventory-payment-policy.runtime" },
      ],
      api: [
        {
          id: "@voyant-travel/finance#booking-schedule-extension.api.admin",
          surface: "admin",
          mount: "bookings",
          openapi: { document: "bookings" },
          runtime: {
            entry: "@voyant-travel/finance",
            export: "createBookingScheduleApiExtension",
          },
        },
        {
          id: "@voyant-travel/finance#booking-schedule-extension.api.public",
          surface: "public",
          mount: "payment-policy",
          openapi: { document: "bookings" },
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/finance",
            export: "createBookingScheduleApiExtension",
          },
        },
      ],
      subscribers: [
        {
          id: "@voyant-travel/finance#subscriber.booking-schedule-confirmed",
          eventType: "booking.confirmed",
          source: "@voyant-travel/finance/booking-schedule-subscriber",
          runtime: {
            entry: "@voyant-travel/finance/booking-schedule-subscriber",
            export: "bookingScheduleConfirmedSubscriber",
          },
        },
      ],
    })
  })

  it("declares finance routes and existing cross-package widgets", () => {
    expect(financeVoyantModule.admin?.routes?.map(({ id, path }) => [id, path])).toEqual([
      ["@voyant-travel/finance#admin.route.index", "/finance"],
      ["@voyant-travel/finance#admin.route.invoices-index", "/finance/invoices"],
      ["@voyant-travel/finance#admin.route.invoices-detail", "/finance/invoices/$id"],
      [
        "@voyant-travel/finance#admin.route.invoice-number-series",
        "/finance/invoice-number-series",
      ],
      ["@voyant-travel/finance#admin.route.payments-index", "/finance/payments"],
      ["@voyant-travel/finance#admin.route.payments-detail", "/finance/payments/$id"],
      ["@voyant-travel/finance#admin.route.supplier-invoices-index", "/finance/supplier-invoices"],
      [
        "@voyant-travel/finance#admin.route.supplier-invoices-detail",
        "/finance/supplier-invoices/$id",
      ],
      ["@voyant-travel/finance#admin.route.profitability", "/finance/profitability"],
    ])
    expect(financeVoyantModule.admin?.contributions?.map(({ id, slotId }) => [id, slotId])).toEqual(
      [
        [
          "@voyant-travel/finance#admin.contribution.booking-payment-controller",
          "booking.details.payment-controller",
        ],
        [
          "@voyant-travel/finance#admin.contribution.booking-invoices",
          "booking.details.invoices-tab",
        ],
        [
          "@voyant-travel/finance#admin.contribution.booking-pending-payment-sessions",
          "booking.details.finance-start",
        ],
        [
          "@voyant-travel/finance#admin.contribution.booking-payment-policy",
          "booking.details.finance-end",
        ],
        [
          "@voyant-travel/finance#admin.contribution.supplier-payment-policy",
          "supplier.details.payment-policy",
        ],
      ],
    )
    expect(
      financeVoyantModule.admin?.routes?.every((route) =>
        route.requiredScopes?.includes("finance:read"),
      ),
    ).toBe(true)
    expect(
      financeVoyantModule.admin?.contributions?.every((contribution) =>
        contribution.requiredScopes?.includes("finance:read"),
      ),
    ).toBe(true)
    expect(financeVoyantModule.admin?.nav).toEqual([
      expect.objectContaining({
        routeId: "@voyant-travel/finance#admin.route.invoices-index",
        label: { namespace: "finance.admin", key: "invoicesPage.title" },
      }),
    ])
  })
})

function expectConcreteEventSchemas(events: readonly { payloadSchema: unknown }[]) {
  for (const event of events) {
    expect(event.payloadSchema).toEqual(
      expect.objectContaining({
        type: "object",
        required: expect.any(Array),
        properties: expect.any(Object),
      }),
    )
  }
}
