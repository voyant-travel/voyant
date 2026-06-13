import { describe, expect, it, vi } from "vitest"

import { SmartbillApiError, SmartbillRateLimitError } from "../../src/client.js"
import { createSmartbillDriftReconciler } from "../../src/workflows.js"
import { makeClient, smartbillRef } from "./workflow-test-helpers.js"

describe("createSmartbillDriftReconciler", () => {
  it("spaces SmartBill requests during remote discovery", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"))
    try {
      const requestTimes: Array<{ operation: string; time: number }> = []
      const client = makeClient({
        listSeries: vi.fn(async () => {
          requestTimes.push({ operation: "listSeries", time: Date.now() })
          return {
            status: "Ok",
            list: [{ name: "INV", nextNumber: 3, type: "f" }],
          }
        }),
        getPaymentStatus: vi.fn(async (_companyVatCode, _seriesName, number) => {
          requestTimes.push({ operation: `getPaymentStatus:${number}`, time: Date.now() })
          return {
            status: "Ok",
            message: "",
            errorText: "",
            paid: false,
            invoiceTotalAmount: 100,
            paidAmount: 0,
            unpaidAmount: 100,
            payments: [],
          }
        }),
      })

      const resultPromise = createSmartbillDriftReconciler({
        client,
        requestSpacingMs: 250,
        companyVatCode: "RO12345678",
        discoverRemote: true,
        listExternalRefs: async () => [],
      })()

      await vi.advanceTimersByTimeAsync(0)
      expect(requestTimes).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(249)
      expect(requestTimes).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(requestTimes).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(250)
      expect(requestTimes).toHaveLength(3)

      const result = await resultPromise
      expect(result.findings).toHaveLength(2)
      expect(requestTimes.map((request) => request.operation)).toEqual([
        "listSeries",
        "getPaymentStatus:1",
        "getPaymentStatus:2",
      ])
      expect(requestTimes[1]!.time - requestTimes[0]!.time).toBe(250)
      expect(requestTimes[2]!.time - requestTimes[1]!.time).toBe(250)
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns processed drift results after SmartBill rate-limit errors", async () => {
    const onError = vi.fn()
    const verifyRemoteDocument = vi
      .fn()
      .mockResolvedValueOnce("present")
      .mockRejectedValueOnce(
        new SmartbillRateLimitError("SmartBill account blocked", {
          operation: "getPaymentStatus",
          status: 403,
        }),
      )
      .mockResolvedValueOnce("missing")

    const result = await createSmartbillDriftReconciler({
      client: makeClient(),
      listExternalRefs: async () => [
        smartbillRef({
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "1",
            documentType: "invoice",
          },
        }),
        smartbillRef({
          id: "iex_2",
          externalId: "2",
          externalNumber: "2",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "2",
            documentType: "invoice",
          },
        }),
        smartbillRef({
          id: "iex_3",
          externalId: "3",
          externalNumber: "3",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "3",
            documentType: "invoice",
          },
        }),
      ],
      verifyRemoteDocument,
      onError,
    })()

    expect(verifyRemoteDocument).toHaveBeenCalledTimes(2)
    expect(result.checked).toBe(2)
    expect(result.findings).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(onError).toHaveBeenCalledWith(result.errors[0])
  })

  it("does not report missing local documents after rate limits during discovery verification", async () => {
    const onMissingLocal = vi.fn()
    const statusResponse = {
      status: "Ok",
      message: "",
      errorText: "",
      paid: false,
      invoiceTotalAmount: 100,
      paidAmount: 0,
      unpaidAmount: 100,
      payments: [],
    }
    const client = makeClient({
      listSeries: vi.fn(async () => ({
        status: "Ok",
        list: [{ name: "INV", nextNumber: 4, type: "f" }],
      })),
      getPaymentStatus: vi
        .fn()
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce(statusResponse)
        .mockResolvedValueOnce(statusResponse)
        .mockRejectedValueOnce(
          new SmartbillRateLimitError("SmartBill account blocked", {
            operation: "getPaymentStatus",
            status: 403,
          }),
        ),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      companyVatCode: "RO12345678",
      discoverRemote: true,
      listExternalRefs: async () => [
        smartbillRef({
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "1",
            documentType: "invoice",
          },
        }),
        smartbillRef({
          id: "iex_2",
          externalId: "2",
          externalNumber: "2",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "2",
            documentType: "invoice",
          },
        }),
        smartbillRef({
          id: "iex_3",
          externalId: "3",
          externalNumber: "3",
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "3",
            documentType: "invoice",
          },
        }),
      ],
      onMissingLocal,
    })()

    expect(client.getPaymentStatus).toHaveBeenCalledTimes(5)
    expect(result.checked).toBe(2)
    expect(result.findings).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(onMissingLocal).not.toHaveBeenCalled()
  })

  it("skips missing numbers while walking SmartBill series", async () => {
    const client = makeClient({
      listSeries: vi.fn(async () => ({
        status: "Ok",
        list: [{ name: "INV", nextNumber: 3, type: "f" }],
      })),
      getPaymentStatus: vi.fn(async (_companyVatCode, _seriesName, number) => {
        if (number === "1") {
          throw new SmartbillApiError("not found", {
            operation: "getPaymentStatus",
            status: 404,
          })
        }
        return {
          status: "Ok",
          message: "",
          errorText: "",
          paid: false,
          invoiceTotalAmount: 100,
          paidAmount: 0,
          unpaidAmount: 100,
          payments: [],
        }
      }),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      companyVatCode: "RO12345678",
      discoverRemote: true,
      listExternalRefs: async () => [],
    })()

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      type: "missing_local",
      document: { seriesName: "INV", number: "2" },
    })
  })

  it("verifies local refs by exact persisted number when remote discovery is enabled", async () => {
    const ref = smartbillRef({
      metadata: {
        companyVatCode: "RO12345678",
        seriesName: "INV",
        number: "0001",
        documentType: "invoice",
      },
    })
    const client = makeClient({
      listSeries: vi.fn(async () => ({
        status: "Ok",
        list: [{ name: "INV", nextNumber: 2, type: "f" }],
      })),
      getPaymentStatus: vi.fn(async (_companyVatCode, _seriesName, number) => {
        if (number === "1") {
          throw new SmartbillApiError("not found", {
            operation: "getPaymentStatus",
            status: 404,
          })
        }
        return {
          status: "Ok",
          message: "",
          errorText: "",
          paid: false,
          invoiceTotalAmount: 100,
          paidAmount: 0,
          unpaidAmount: 100,
          payments: [],
        }
      }),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      discoverRemote: true,
      listExternalRefs: async () => [ref],
    })()

    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "1")
    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "0001")
    expect(result.findings).toEqual([])
  })

  it("requires a company VAT code for remote discovery when refs cannot provide one", async () => {
    await expect(
      createSmartbillDriftReconciler({
        client: makeClient(),
        discoverRemote: true,
        listExternalRefs: async () => [],
      })(),
    ).rejects.toThrow("SmartBill remote discovery requires companyVatCode")
  })

  it("reports missing remote documents when provider verification fails", async () => {
    const ref = smartbillRef({
      metadata: {
        companyVatCode: "RO12345678",
        seriesName: "INV",
        series: "INV",
        number: "42",
        documentType: "invoice",
      },
      invoice: {
        id: "inv_42",
        invoiceNumber: "INV-42",
        invoiceType: "invoice",
        status: "sent",
        currency: "RON",
        totalCents: 10000,
        paidCents: 0,
        balanceDueCents: 10000,
      },
    })
    const client = makeClient({
      getPaymentStatus: vi.fn(async () => {
        throw new Error("not found")
      }),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      listExternalRefs: async () => [ref],
    })()

    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "42")
    expect(result.findings[0]).toMatchObject({
      type: "missing_remote",
      ref,
      document: { seriesName: "INV", number: "42" },
    })
  })

  it("reports voided remote documents that are still active locally", async () => {
    const result = await createSmartbillDriftReconciler({
      client: makeClient(),
      listExternalRefs: async () => [
        smartbillRef({
          metadata: {
            companyVatCode: "RO12345678",
            seriesName: "INV",
            number: "7",
            documentType: "invoice",
          },
        }),
      ],
      verifyRemoteDocument: async () => "cancelled",
    })()

    expect(result.findings[0]).toMatchObject({
      type: "voided_remote",
      document: { seriesName: "INV", number: "7" },
    })
  })

  it("reports voided remote invoices from default payment status messages", async () => {
    const ref = smartbillRef({
      metadata: {
        companyVatCode: "RO12345678",
        seriesName: "INV",
        number: "8",
        documentType: "invoice",
      },
      invoice: {
        id: "inv_8",
        invoiceNumber: "INV-8",
        invoiceType: "invoice",
        status: "sent",
        currency: "RON",
        totalCents: 10000,
        paidCents: 0,
        balanceDueCents: 10000,
      },
    })
    const client = makeClient({
      getPaymentStatus: vi.fn(async () => ({
        status: "Ok",
        message: "Invoice cancelled",
        errorText: "",
        paid: false,
        invoiceTotalAmount: 100,
        paidAmount: 0,
        unpaidAmount: 100,
        payments: [],
      })),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      listExternalRefs: async () => [ref],
    })()

    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "8")
    expect(result.findings[0]).toMatchObject({
      type: "voided_remote",
      document: { seriesName: "INV", number: "8" },
      remote: { status: "cancelled" },
    })
  })
})
