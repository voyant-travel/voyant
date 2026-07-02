import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { SupplierRate, SupplierService } from "./index.js"
import { VoyantSuppliersProvider } from "./index.js"

function withProviders(children: ReactNode) {
  return (
    <VoyantSuppliersProvider baseUrl="/api">
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    </VoyantSuppliersProvider>
  )
}

import { SupplierNestedResources } from "./components/supplier-nested-resources.js"
import { SupplierServiceRow } from "./components/supplier-service-row.js"
import { SuppliersPage } from "./components/suppliers-page.js"
import {
  getSuppliersUiI18n,
  resolveSuppliersUiMessages,
  SuppliersUiMessagesProvider,
  useSuppliersUiMessagesOrDefault,
} from "./i18n/index.js"

const service: SupplierService = {
  id: "service-1",
  supplierId: "supplier-1",
  serviceType: "guide",
  name: "City Tour",
  description: null,
  duration: "2h",
  capacity: 10,
  active: false,
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const rates: SupplierRate[] = [
  {
    id: "rate-1",
    serviceId: "service-1",
    name: "Standard",
    currency: "EUR",
    amountCents: 12500,
    unit: "per_person",
    validFrom: "2026-05-01",
    validTo: "2026-09-30",
    minPax: 1,
    maxPax: 8,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

describe("suppliers-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveSuppliersUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            suppliersPage: {
              create: "Creeaza Furnizor",
            },
          },
        },
      },
    })

    expect(result.suppliersPage.create).toBe("Creeaza Furnizor")
    expect(result.common.supplierStatusLabels.pending).toBe("In asteptare")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getSuppliersUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(
      withProviders(
        <div>
          <SuppliersPage />
          <SupplierServiceRow
            service={service}
            rates={rates}
            expanded
            onToggle={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            onAddRate={() => {}}
            onEditRate={() => {}}
            onDeleteRate={() => {}}
          />
          <SupplierNestedResources
            supplierId="supplier-1"
            locale="en-US"
            confirmAction={() => true}
          />
          <SuppliersMessageProbe />
        </div>,
      ),
    )

    expect(html).toContain("Suppliers")
    expect(html).toContain("New Supplier")
    expect(html).toContain("Rates")
    expect(html).toContain("Contact points")
    expect(html).toContain("Set availability")
    expect(html).toContain("Contracts")
    expect(html).toContain("Guide")
    expect(html).toContain("Per person")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      withProviders(
        <SuppliersUiMessagesProvider locale="ro-RO">
          <div>
            <SuppliersPage />
            <SupplierServiceRow
              service={service}
              rates={rates}
              expanded
              onToggle={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onAddRate={() => {}}
              onEditRate={() => {}}
              onDeleteRate={() => {}}
            />
            <SupplierNestedResources
              supplierId="supplier-1"
              locale="ro-RO"
              confirmAction={() => true}
            />
            <SuppliersMessageProbe />
          </div>
        </SuppliersUiMessagesProvider>,
      ),
    )

    expect(html).toContain("Furnizori")
    expect(html).toContain("Furnizor Nou")
    expect(html).toContain("Tarife")
    expect(html).toContain("Puncte de contact")
    expect(html).toContain("Seteaza disponibilitate")
    expect(html).toContain("Contracte")
    expect(html).toContain("Ghid")
    expect(html).toContain("Per persoana")
  })
})

function SuppliersMessageProbe() {
  const messages = useSuppliersUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.common.serviceTypeLabels.guide}</span>
      <span>{messages.common.rateUnitLabels.per_person}</span>
      <span>{messages.common.contactPointKindLabels.email}</span>
      <span>{messages.common.contractStatusLabels.active}</span>
    </div>
  )
}
