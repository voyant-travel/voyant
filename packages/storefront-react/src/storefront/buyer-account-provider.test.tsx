import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type BuyerAccountContextValue,
  BuyerAccountProvider,
  BuyerAccountSelector,
  createBuyerAccountFetcher,
  useBuyerAccounts,
} from "./buyer-account-provider.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe("BuyerAccountProvider", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("loads personal/business accounts and refetches session state after selection", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let selected = false
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith("/buyer-accounts/active")) {
        selected = true
        return Response.json({ activeAccount: businessAccount })
      }
      if (url.endsWith("/buyer-accounts")) {
        return Response.json({
          accounts: [personalAccount, businessAccount],
          activeAccount: selected ? businessAccount : personalAccount,
          policy,
          requiresSelection: false,
        })
      }
      if (url.endsWith("/get-session")) {
        return Response.json({
          session: {
            id: selected ? "session-business" : "session-personal",
            userId: "customer-1",
          },
          user: { id: "customer-1" },
        })
      }
      return new Response(null, { status: 404 })
    })
    const stateRef: { current: BuyerAccountContextValue | null } = {
      current: null,
    }
    const currentState = (): BuyerAccountContextValue => {
      if (!stateRef.current) throw new Error("Buyer account state was not rendered")
      return stateRef.current
    }

    await act(async () => {
      root.render(
        <BuyerAccountProvider baseUrl="/api" fetcher={fetcher}>
          <StateProbe onState={(value) => (stateRef.current = value)} />
          <BuyerAccountSelector />
        </BuyerAccountProvider>,
      )
    })

    expect(currentState().loading).toBe(false)
    expect(currentState().accounts.map((account) => account.kind)).toEqual(["personal", "business"])
    expect(currentState().active?.id).toBe("buyer-personal")
    expect(currentState().policy).toEqual(policy)
    expect(host.textContent).toContain("Personal account")
    expect(host.textContent).toContain("Acme Corp")

    await act(async () => {
      await currentState().selectAccount("buyer-business")
    })

    expect(currentState().active?.id).toBe("buyer-business")
    expect(currentState().session?.session.id).toBe("session-business")
    expect(calls.filter(({ url }) => url.endsWith("/buyer-accounts"))).toHaveLength(2)
    expect(calls.filter(({ url }) => url.endsWith("/get-session"))).toHaveLength(2)
    expect(calls.find(({ url }) => url.endsWith("/buyer-accounts/active"))?.init).toMatchObject({
      method: "POST",
      credentials: "include",
    })
    expect(calls.every(({ init }) => init?.credentials === "include")).toBe(true)
  })

  it("forces credentialed fetches even when a caller supplies another mode", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    const credentialed = createBuyerAccountFetcher(fetcher)

    await credentialed("/api/auth/customer/buyer-accounts", {
      credentials: "omit",
    })

    expect(fetcher).toHaveBeenCalledWith("/api/auth/customer/buyer-accounts", {
      credentials: "include",
    })
  })
})

function StateProbe({ onState }: { onState: (state: BuyerAccountContextValue) => void }) {
  onState(useBuyerAccounts())
  return null
}

const policy = {
  allowedKinds: ["personal", "business"] as Array<"personal" | "business">,
  personalSignup: "open" as const,
  businessOnboarding: "request" as const,
}

const personalAccount = {
  id: "buyer-personal",
  name: "Personal account",
  kind: "personal" as const,
  authOrganizationId: null,
  relationshipOrganizationId: null,
  relationshipPersonId: "person-1",
  membershipId: null,
  membershipRole: null,
}

const businessAccount = {
  id: "buyer-business",
  name: "Acme Corp",
  kind: "business" as const,
  authOrganizationId: "auth-org-1",
  relationshipOrganizationId: "relationship-org-1",
  relationshipPersonId: null,
  membershipId: "membership-1",
  membershipRole: "buyer",
}
