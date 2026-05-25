import type { InvoiceNumberSeriesRecord } from "@voyantjs/finance-react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const financeReactState = vi.hoisted(() => ({
  series: [] as InvoiceNumberSeriesRecord[],
}))

vi.mock("@voyantjs/finance-react", () => ({
  useInvoiceNumberSeries: () => ({
    data: { data: financeReactState.series },
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
  useInvoiceNumberSeriesMutation: () => ({
    remove: {
      isPending: false,
      mutateAsync: vi.fn(async () => undefined),
    },
    create: {
      isPending: false,
      mutateAsync: vi.fn(async () => undefined),
    },
    update: {
      isPending: false,
      mutateAsync: vi.fn(async () => undefined),
    },
  }),
}))

import { InvoiceNumberSeriesPage } from "./components/invoice-number-series-page.js"

function series(data: Partial<InvoiceNumberSeriesRecord> = {}): InvoiceNumberSeriesRecord {
  return {
    id: "ins_123",
    code: "empty-prefix",
    name: "Empty prefix",
    prefix: "",
    separator: "-",
    padLength: 4,
    currentSequence: 7,
    resetStrategy: "never",
    resetAt: null,
    scope: "invoice",
    isDefault: true,
    externalProvider: null,
    externalConfigKey: null,
    active: true,
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    ...data,
  }
}

describe("InvoiceNumberSeriesPage", () => {
  it("formats samples the same way as server-side allocation", () => {
    financeReactState.series = [series()]

    const html = renderToStaticMarkup(<InvoiceNumberSeriesPage />)

    expect(html).toContain("-0008")
  })
})
