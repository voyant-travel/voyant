import { beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  invalidateQueries: vi.fn(async () => undefined),
  setQueryData: vi.fn(),
  removeQueries: vi.fn(),
  mutations: [] as Array<{
    onSuccess?: (data: Record<string, unknown>, variables?: unknown) => void
  }>,
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: testState.invalidateQueries,
    setQueryData: testState.setQueryData,
    removeQueries: testState.removeQueries,
  }),
  useMutation: (options: {
    onSuccess?: (data: Record<string, unknown>, variables?: unknown) => void
  }) => {
    testState.mutations.push(options)
    return {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    }
  },
}))

vi.mock("../../src/provider.js", () => ({
  useVoyantFinanceContext: () => ({
    baseUrl: "",
    fetcher: vi.fn(),
  }),
}))

describe("useInvoiceMutation", () => {
  beforeEach(() => {
    testState.invalidateQueries.mockReset()
    testState.invalidateQueries.mockResolvedValue(undefined)
    testState.setQueryData.mockReset()
    testState.removeQueries.mockReset()
    testState.mutations.length = 0
  })

  it("refreshes booking-scoped caches after issuing an invoice from a booking", async () => {
    const { useInvoiceMutation } = await import("../../src/hooks/use-invoice-mutation.js")

    useInvoiceMutation()

    const createFromBooking = testState.mutations[4]
    expect(createFromBooking).toBeTruthy()
    createFromBooking?.onSuccess?.({
      id: "inv_123",
      bookingId: "book_123",
      invoiceNumber: "INV-123",
    })

    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "finance", "invoices"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123", "activity"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123", "action-ledger"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "finance", "admin-booking-payments", "book_123"],
    })
  })
})
