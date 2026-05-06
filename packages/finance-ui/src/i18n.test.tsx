import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { InvoiceDialog } from "./components/invoice-dialog.js"
import { SupplierPaymentDialog } from "./components/supplier-payment-dialog.js"
import {
  FinanceUiMessagesProvider,
  getFinanceUiI18n,
  resolveFinanceUiMessages,
  useFinanceUiMessagesOrDefault,
} from "./i18n/index.js"

vi.mock("@voyantjs/finance-react", () => ({
  useInvoiceMutation: () => ({
    create: {
      isPending: false,
      mutateAsync: async (value: unknown) => value,
    },
    update: {
      isPending: false,
      mutateAsync: async (value: unknown) => value,
    },
  }),
  useSupplierPaymentMutation: () => ({
    create: {
      isPending: false,
      mutateAsync: async (value: unknown) => value,
    },
  }),
}))

describe("finance-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveFinanceUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            supplierPaymentDialog: {
              actions: {
                create: "Adauga Plata",
              },
            },
          },
        },
      },
    })

    expect(result.supplierPaymentDialog.actions.create).toBe("Adauga Plata")
    expect(result.common.invoiceStatusLabels.partially_paid).toBe("Platita Partial")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getFinanceUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(
      <div>
        <InvoiceDialog open onOpenChange={() => {}} />
        <SupplierPaymentDialog open onOpenChange={() => {}} />
        <FinanceMessageProbe />
      </div>,
    )

    expect(html).toContain("Edit Invoice")
    expect(html).toContain("Record Supplier Payment")
    expect(html).toContain("Draft")
    expect(html).toContain("Bank Transfer")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <FinanceUiMessagesProvider locale="ro-RO">
        <div>
          <InvoiceDialog open onOpenChange={() => {}} />
          <SupplierPaymentDialog open onOpenChange={() => {}} />
          <FinanceMessageProbe />
        </div>
      </FinanceUiMessagesProvider>,
    )

    expect(html).toContain("Editeaza Factura")
    expect(html).toContain("Inregistreaza Plata Furnizorului")
    expect(html).toContain("Ciorna")
    expect(html).toContain("Transfer Bancar")
  })
})

function FinanceMessageProbe() {
  const messages = useFinanceUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.invoiceDialog.titles.edit}</span>
      <span>{messages.supplierPaymentDialog.title}</span>
      <span>{messages.common.invoiceStatusLabels.draft}</span>
      <span>{messages.common.supplierPaymentMethodLabels.bank_transfer}</span>
    </div>
  )
}
