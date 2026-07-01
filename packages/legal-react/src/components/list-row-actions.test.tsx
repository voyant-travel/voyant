import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { LegalContractNumberSeriesRecord, LegalContractTemplateRecord } from "../schemas.js"

const legalState = vi.hoisted(() => ({
  numberSeries: [] as LegalContractNumberSeriesRecord[],
  templates: [] as LegalContractTemplateRecord[],
}))

vi.mock("../index.js", () => ({
  useLegalContractNumberSeries: () => ({
    data: { data: legalState.numberSeries },
    isPending: false,
    refetch: vi.fn(),
  }),
  useLegalContractNumberSeriesMutation: () => ({
    remove: {
      mutate: vi.fn(),
    },
  }),
  useLegalContractTemplateMutation: () => ({
    remove: {
      mutate: vi.fn(),
    },
  }),
  useLegalContractTemplates: () => ({
    data: { data: legalState.templates },
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
  }),
}))

import { NumberSeriesPage } from "./number-series-page.js"
import { TemplatesPage } from "./templates-page.js"

describe("legal list row actions", () => {
  it("names the template row edit and delete buttons", () => {
    legalState.templates = [
      {
        id: "ctpl_1",
        name: "Customer agreement",
        slug: "customer-agreement",
        description: null,
        body: "Hello",
        bodyFormat: "html",
        scope: "customer",
        language: "en",
        active: true,
        isDefault: false,
        currentVersionId: null,
        variableSchema: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      } as LegalContractTemplateRecord,
    ]

    const html = renderToStaticMarkup(
      <TemplatesPage renderTemplateDialog={() => null} onOpenTemplate={vi.fn()} />,
    )

    expect(html).toContain('aria-label="Edit template"')
    expect(html).toContain('title="Edit template"')
    expect(html).toContain('aria-label="Delete template"')
    expect(html).toContain('title="Delete template"')
  })

  it("names the number-series row edit and delete buttons", () => {
    legalState.numberSeries = [
      {
        id: "cns_1",
        name: "Default series",
        prefix: "CTR",
        separator: "-",
        padLength: 4,
        currentSequence: 7,
        resetStrategy: "never",
        scope: "customer",
        active: true,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      } as LegalContractNumberSeriesRecord,
    ]

    const html = renderToStaticMarkup(<NumberSeriesPage renderNumberSeriesDialog={() => null} />)

    expect(html).toContain('aria-label="Edit number series"')
    expect(html).toContain('title="Edit number series"')
    expect(html).toContain('aria-label="Delete number series"')
    expect(html).toContain('title="Delete number series"')
  })
})
