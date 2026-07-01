import { beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  invalidateQueries: vi.fn(async () => undefined),
  mutations: [] as Array<{ onSuccess?: () => void }>,
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: testState.invalidateQueries,
  }),
  useMutation: (options: { onSuccess?: () => void }) => {
    testState.mutations.push(options)
    return {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    }
  },
}))

vi.mock("../../src/provider.js", () => ({
  useVoyantBookingsContext: () => ({
    baseUrl: "",
    fetcher: vi.fn(),
  }),
}))

describe("useBookingItemMutation", () => {
  beforeEach(() => {
    testState.invalidateQueries.mockReset()
    testState.invalidateQueries.mockResolvedValue(undefined)
    testState.mutations.length = 0
  })

  it("refreshes the parent booking, lists, items, activity, and action ledger", async () => {
    const { useBookingItemMutation } = await import("../../src/hooks/use-booking-item-mutation.js")

    useBookingItemMutation("book_123")

    expect(testState.mutations).toHaveLength(3)

    for (const mutation of testState.mutations) {
      mutation.onSuccess?.()
    }

    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123"],
      exact: true,
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123", "items"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123", "activity"],
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "bookings", "bookings", "detail", "book_123", "action-ledger"],
    })

    expect(testState.invalidateQueries).toHaveBeenCalledTimes(15)
  })
})
