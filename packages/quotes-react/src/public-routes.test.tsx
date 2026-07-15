import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { createQuotesPublicRouteContribution } from "./public-routes.js"

describe("quotes public presentation", () => {
  it("matches the package-owned presentation declaration", () => {
    const contribution = createQuotesPublicRouteContribution({
      getApiUrl: vi.fn(() => "/api"),
      StorefrontMessagesProvider: ({ children }: { children: ReactNode }) => children,
      useProposalMessages: vi.fn(),
    } as never)

    expect(contribution.id).toBe("@voyant-travel/quotes#presentation.public")
    expect(Object.keys(contribution.routes)).toEqual(["proposal"])
  })
})
