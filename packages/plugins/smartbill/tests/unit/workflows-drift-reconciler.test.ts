import { describe, expect, it, vi } from "vitest"
import { loadSmartbillCandidateRefs } from "../../src/workflow-candidates.js"
import { createSmartbillDriftReconciler } from "../../src/workflows.js"
import { makeClient, smartbillRef } from "./workflow-test-helpers.js"

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
})
