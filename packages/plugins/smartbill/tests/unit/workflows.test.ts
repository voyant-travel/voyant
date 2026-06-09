import { describe, expect, it, vi } from "vitest"

import {
  SmartbillApiError,
  type SmartbillClientApi,
  SmartbillRateLimitError,
} from "../../src/client.js"
import { loadSmartbillCandidateRefs } from "../../src/workflow-candidates.js"
import {
  createSmartbillDriftReconciler,
  createSmartbillProformaConversionPoller,
  type SmartbillWorkflowExternalRef,
} from "../../src/workflows.js"

function makeClient(overrides: Partial<SmartbillClientApi> = {}): SmartbillClientApi {
  return {
    createInvoice: vi.fn(),
    createProforma: vi.fn(),
    cancelInvoice: vi.fn(),
    restoreInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
    reverseInvoice: vi.fn(),
    viewInvoicePdf: vi.fn(),
    viewPdf: vi.fn(),
    viewEstimatePdf: vi.fn(),
    getPaymentStatus: vi.fn(),
    listTaxes: vi.fn(),
    listSeries: vi.fn(),
    listEstimateInvoices: vi.fn(),
    ...overrides,
  } as SmartbillClientApi
}

function smartbillRef(
  overrides: Partial<SmartbillWorkflowExternalRef> = {},
): SmartbillWorkflowExternalRef {
  return {
    id: "iex_1",
    invoiceId: "inv_1",
    provider: "smartbill",
    externalId: "1",
    externalNumber: "1",
    externalUrl: null,
    status: "issued",
    syncError: null,
    metadata: {
      companyVatCode: "RO12345678",
      seriesName: "PF",
      series: "PF",
      number: "1",
      documentType: "proforma",
    },
    invoice: {
      id: "inv_1",
      invoiceNumber: "PF-1",
      invoiceType: "proforma",
      status: "sent",
      currency: "RON",
      totalCents: 10000,
      paidCents: 0,
      balanceDueCents: 10000,
    },
    ...overrides,
  }
}

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

describe("createSmartbillDriftReconciler", () => {
  it("reports missing local documents from a remote inventory callback", async () => {
    const onFinding = vi.fn()
    const client = makeClient({
      listEstimateInvoices: vi.fn(async () => ({ status: "Ok", areInvoicesCreated: false })),
    })

    const result = await createSmartbillDriftReconciler({
      client,
      listExternalRefs: async () => [smartbillRef()],
      listRemoteDocuments: async () => [
        {
          documentType: "proforma",
          companyVatCode: "RO12345678",
          seriesName: "PF",
          number: "1",
          status: "issued",
        },
        {
          documentType: "invoice",
          companyVatCode: "RO12345678",
          seriesName: "INV",
          number: "99",
          status: "issued",
        },
      ],
      onFinding,
    })()

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      type: "missing_local",
      document: { seriesName: "INV", number: "99" },
    })
    expect(onFinding).toHaveBeenCalledWith(result.findings[0])
  })

  it("can verify local invoice candidates without external refs", async () => {
    const verifyRemoteDocument = vi.fn(async () => "present" as const)

    const result = await createSmartbillDriftReconciler({
      client: makeClient(),
      companyVatCode: "RO12345678",
      listCandidateInvoices: async () => [
        {
          invoiceId: "inv_candidate",
          invoiceNumber: "INV-42",
          documentType: "invoice",
          seriesName: "INV",
          status: "issued",
          currency: "RON",
          totalCents: 10000,
          paidCents: 0,
          balanceDueCents: 10000,
        },
      ],
      verifyRemoteDocument,
    })()

    expect(verifyRemoteDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: expect.objectContaining({
          id: "candidate:inv_candidate",
          invoiceId: "inv_candidate",
          externalNumber: "42",
        }),
        document: expect.objectContaining({
          companyVatCode: "RO12345678",
          seriesName: "INV",
          number: "42",
          documentType: "invoice",
        }),
      }),
    )
    expect(result.checked).toBe(1)
    expect(result.findings).toEqual([])
  })

  it("uses SmartBill series keys and skips pending placeholders from DB invoice candidates", async () => {
    const rows = [
      {
        invoice: {
          id: "inv_issued",
          invoiceNumber: "B-0133",
          invoiceType: "invoice",
          status: "issued",
          currency: "RON",
          totalCents: 10000,
          paidCents: 0,
          balanceDueCents: 10000,
          sequence: 133,
        },
        seriesName: "B",
      },
      {
        invoice: {
          id: "inv_pending",
          invoiceNumber: "PENDING-smartbill-invoice-1",
          invoiceType: "invoice",
          status: "pending_external_allocation",
          currency: "RON",
          totalCents: 10000,
          paidCents: 0,
          balanceDueCents: 10000,
          sequence: null,
        },
        seriesName: "B",
      },
    ]
    const query = {
      from: vi.fn(() => query),
      leftJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(async () => rows),
    }
    const db = { select: vi.fn(() => query) }
    const recordCandidateExternalRef = vi.fn(async ({ ref }) => ref)

    const refs = await loadSmartbillCandidateRefs({
      db: db as never,
      companyVatCode: "RO12345678",
      recordCandidateExternalRef,
    })

    expect(query.limit).toHaveBeenCalledWith(500)
    expect(recordCandidateExternalRef).toHaveBeenCalledTimes(1)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      invoiceId: "inv_issued",
      externalNumber: "0133",
      metadata: {
        companyVatCode: "RO12345678",
        invoiceNumber: "B-0133",
        seriesName: "B",
        series: "B",
        number: "0133",
        documentType: "invoice",
      },
    })
  })

  it("requires db or listCandidateInvoices for the invoices source", async () => {
    await expect(
      createSmartbillDriftReconciler({
        client: makeClient(),
        source: "invoices",
      })(),
    ).rejects.toThrow("SmartBill invoice candidate source requires db or listCandidateInvoices")
  })

  it("discovers missing local documents from SmartBill series when opted in", async () => {
    const onMissingLocal = vi.fn()
    const client = makeClient({
      listSeries: vi.fn(async () => ({
        status: "Ok",
        list: [
          { name: "INV", nextNumber: 3, type: "f" },
          { name: "PF", nextNumber: 2, type: "p" },
        ],
      })),
      getPaymentStatus: vi.fn(async (_companyVatCode, _seriesName, number) => ({
        status: "Ok",
        message: "",
        errorText: "",
        paid: number === "2",
        invoiceTotalAmount: 100,
        paidAmount: number === "2" ? 100 : 0,
        unpaidAmount: number === "2" ? 0 : 100,
        payments: [],
      })),
      listEstimateInvoices: vi.fn(async () => ({
        status: "Ok",
        areInvoicesCreated: false,
        invoices: [],
      })),
      viewInvoicePdf: vi.fn(async () => ({
        bytes: new Uint8Array([1]),
        contentType: "application/pdf",
      })),
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
      ],
      onMissingLocal,
    })()

    expect(client.listSeries).toHaveBeenCalledOnce()
    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "1")
    expect(client.getPaymentStatus).toHaveBeenCalledWith("RO12345678", "INV", "2")
    expect(client.listEstimateInvoices).toHaveBeenCalledWith("RO12345678", "PF", "1")
    expect(result.findings).toHaveLength(2)
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing_local",
          document: expect.objectContaining({ seriesName: "INV", number: "2" }),
          remote: expect.objectContaining({ status: "paid" }),
        }),
        expect.objectContaining({
          type: "missing_local",
          document: expect.objectContaining({ seriesName: "PF", number: "1" }),
          remote: expect.objectContaining({ status: "present" }),
        }),
      ]),
    )
    expect(onMissingLocal).toHaveBeenCalledTimes(2)

    const invoiceFinding = result.findings.find(
      (finding) => finding.type === "missing_local" && finding.document.seriesName === "INV",
    )
    if (!invoiceFinding || invoiceFinding.type !== "missing_local") {
      throw new Error("Expected discovered invoice finding")
    }

    await invoiceFinding.remote.accessors?.viewPdf()
    expect(client.viewInvoicePdf).toHaveBeenCalledWith("RO12345678", "INV", "2")
  })

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
