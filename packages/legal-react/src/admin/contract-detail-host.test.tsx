import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  navigateTo: vi.fn(),
}))

vi.mock("@voyant-travel/admin", () => ({
  useAdminBreadcrumbs: vi.fn(),
  useAdminHref: () => (destination: string) => `/${destination}`,
  useAdminNavigate: () => testState.navigateTo,
  useOperatorAdminMessages: () => ({
    nav: {
      legal: "Legal",
      contracts: "Contracts",
    },
  }),
}))

vi.mock("@voyant-travel/bookings-react", () => ({
  useBooking: () => ({ data: undefined }),
}))

vi.mock("@voyant-travel/relationships-react", () => ({
  usePerson: () => ({ data: undefined }),
}))

vi.mock("../index.js", () => ({
  useLegalContract: () => ({
    data: {
      id: "cont_123",
      title: "Draft contract",
      contractNumber: null,
      personId: null,
    },
  }),
  useLegalContractNumberSeries: () => ({ data: { data: [] } }),
  useLegalContractTemplates: () => ({ data: { data: [] } }),
  useVoyantLegalContext: () => ({ baseUrl: "https://example.test" }),
}))

import { ContractDetailHost } from "./contract-detail-host.js"

describe("ContractDetailHost", () => {
  it("navigates back to the contracts list when the detail page requests it", () => {
    testState.navigateTo.mockClear()

    const element = ContractDetailHost({ id: "cont_123" }) as ReactElement<{
      onBackToContracts?: () => void
    }>

    expect(element.props.onBackToContracts).toBeTypeOf("function")

    element.props.onBackToContracts?.()

    expect(testState.navigateTo).toHaveBeenCalledWith("contract.list", {})
  })
})
