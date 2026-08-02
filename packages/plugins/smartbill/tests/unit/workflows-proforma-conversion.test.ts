import { describe, expect, it, vi } from "vitest"

import { SmartbillRateLimitError } from "../../src/client.js"
import { createSmartbillProformaConversionPoller } from "../../src/workflows.js"
import { makeClient, smartbillRef } from "./workflow-test-helpers.js"

describe("createSmartbillProformaConversionPoller", () => {
  it("detects converted proformas and calls onConverted", async () => {
    const ref = smartbillRef()
    const onConverted = vi.fn()
    const client = makeClient({
      listEstimateInvoices: vi.fn(async () => ({
        status: "Ok",
        areInvoicesCreated: true,
        invoices: [{ series: "INV", number: "42", url: "https://smartbill.test/inv-42.pdf" }],
      })),
    })

    const poller = createSmartbillProformaConversionPoller({
      client,
      listExternalRefs: async () => [ref],
      onConverted,
    })

    const result = await poller()

    expect(client.listEstimateInvoices).toHaveBeenCalledWith("RO12345678", "PF", "1")
    expect(onConverted).toHaveBeenCalledOnce()
    expect(onConverted.mock.calls[0]![0]).toBe(ref)
    expect(onConverted.mock.calls[0]![1]).toMatchObject({
      proformaRef: ref,
      invoiceSeriesName: "INV",
      invoiceNumber: "42",
      invoiceUrl: "https://smartbill.test/inv-42.pdf",
    })
    expect(result.converted).toHaveLength(1)
    expect(result.skipped).toEqual([])
  })

  it("skips unconverted proformas", async () => {
    const client = makeClient({
      listEstimateInvoices: vi.fn(async () => ({
        status: "Ok",
        areInvoicesCreated: false,
        invoices: [],
      })),
    })

    const result = await createSmartbillProformaConversionPoller({
      client,
      listExternalRefs: async () => [smartbillRef()],
      onConverted: vi.fn(),
    })()

    expect(result.converted).toEqual([])
    expect(result.skipped[0]?.reason).toBe("not_converted")
  })

  it("can poll proforma conversions from invoice candidates", async () => {
    const onConverted = vi.fn()
    const recordCandidateExternalRef = vi.fn(async ({ ref }) => ({
      ...ref,
      id: "iex_candidate",
    }))
    const client = makeClient({
      listEstimateInvoices: vi.fn(async () => ({
        status: "Ok",
        areInvoicesCreated: true,
        invoices: [{ series: "INV", number: "42", url: "https://smartbill.test/inv-42.pdf" }],
      })),
    })

    const result = await createSmartbillProformaConversionPoller({
      client,
      companyVatCode: "RO12345678",
      listCandidateInvoices: async () => [
        {
          invoiceId: "inv_candidate",
          invoiceNumber: "PF-9",
          documentType: "proforma",
          seriesName: "PF",
          status: "issued",
          currency: "RON",
          totalCents: 10000,
          paidCents: 0,
          balanceDueCents: 10000,
        },
      ],
      recordCandidateExternalRef,
      onConverted,
    })()

    expect(recordCandidateExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: expect.objectContaining({ invoiceId: "inv_candidate" }),
        document: expect.objectContaining({
          companyVatCode: "RO12345678",
          seriesName: "PF",
          number: "9",
          documentType: "proforma",
        }),
      }),
    )
    expect(client.listEstimateInvoices).toHaveBeenCalledWith("RO12345678", "PF", "9")
    expect(onConverted).toHaveBeenCalledOnce()
    expect(onConverted.mock.calls[0]![0]).toMatchObject({
      id: "iex_candidate",
      invoiceId: "inv_candidate",
      externalNumber: "9",
    })
    expect(result.converted[0]).toMatchObject({
      proformaNumber: "9",
      invoiceSeriesName: "INV",
      invoiceNumber: "42",
    })
  })

  it("spaces SmartBill requests when requestSpacingMs is set", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"))
    try {
      const requestTimes: number[] = []
      const client = makeClient({
        listEstimateInvoices: vi.fn(async () => {
          requestTimes.push(Date.now())
          return {
            status: "Ok",
            areInvoicesCreated: false,
            invoices: [],
          }
        }),
      })

      const resultPromise = createSmartbillProformaConversionPoller({
        client,
        requestSpacingMs: 350,
        listExternalRefs: async () => [
          smartbillRef(),
          smartbillRef({
            id: "iex_2",
            externalId: "2",
            externalNumber: "2",
            metadata: {
              companyVatCode: "RO12345678",
              seriesName: "PF",
              number: "2",
              documentType: "proforma",
            },
          }),
          smartbillRef({
            id: "iex_3",
            externalId: "3",
            externalNumber: "3",
            metadata: {
              companyVatCode: "RO12345678",
              seriesName: "PF",
              number: "3",
              documentType: "proforma",
            },
          }),
        ],
        onConverted: vi.fn(),
      })()

      await vi.advanceTimersByTimeAsync(0)
      expect(requestTimes).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(349)
      expect(requestTimes).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(requestTimes).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(350)
      expect(requestTimes).toHaveLength(3)

      const result = await resultPromise
      expect(result.checked).toBe(3)
      expect(requestTimes[1]! - requestTimes[0]!).toBe(350)
      expect(requestTimes[2]! - requestTimes[1]!).toBe(350)
    } finally {
      vi.useRealTimers()
    }
  })

  it("stops after SmartBill rate-limit errors", async () => {
    const onError = vi.fn()
    const client = makeClient({
      listEstimateInvoices: vi
        .fn()
        .mockResolvedValueOnce({
          status: "Ok",
          areInvoicesCreated: false,
          invoices: [],
        })
        .mockRejectedValueOnce(
          new SmartbillRateLimitError("SmartBill account blocked", {
            operation: "listEstimateInvoices",
            status: 403,
          }),
        )
        .mockResolvedValueOnce({
          status: "Ok",
          areInvoicesCreated: false,
          invoices: [],
        }),
    })

    const result = await createSmartbillProformaConversionPoller({
      client,
      listExternalRefs: async () => [
        smartbillRef(),
        smartbillRef({
          id: "iex_2",
          externalId: "2",
          externalNumber: "2",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "PF",
            number: "2",
            documentType: "proforma",
          },
        }),
        smartbillRef({
          id: "iex_3",
          externalId: "3",
          externalNumber: "3",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "PF",
            number: "3",
            documentType: "proforma",
          },
        }),
      ],
      onConverted: vi.fn(),
      onError,
    })()

    expect(client.listEstimateInvoices).toHaveBeenCalledTimes(2)
    expect(result.checked).toBe(2)
    expect(result.skipped[0]?.reason).toBe("not_converted")
    expect(result.errors).toHaveLength(1)
    expect(onError).toHaveBeenCalledWith(result.errors[0])
  })
})
