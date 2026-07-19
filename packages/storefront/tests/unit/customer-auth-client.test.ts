import { describe, expect, it, vi } from "vitest"

import { createCustomerAuthClient } from "../../src/customer-auth-client.js"

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("framework-neutral customer auth client", () => {
  it("parses enabled configuration when the server omits disabled=false", async () => {
    const fetcher = vi.fn(async () =>
      response({
        methods: {
          emailCode: true,
          emailPassword: true,
          google: false,
          facebook: false,
          apple: false,
        },
        accountPolicy: {
          allowedKinds: ["personal", "business"],
          personalSignup: "open",
          businessOnboarding: "request",
        },
      }),
    )
    const config = await createCustomerAuthClient({ baseUrl: "/api/", fetcher }).getConfiguration()
    expect(config).toEqual(expect.objectContaining({ disabled: false }))
    expect(fetcher).toHaveBeenCalledWith("/api/auth/customer/config", {
      method: "GET",
      credentials: "include",
    })
  })

  it("parses disabled configuration without inventing an account policy", async () => {
    const fetcher = vi.fn(async () =>
      response({
        disabled: true,
        methods: {
          emailCode: false,
          emailPassword: false,
          google: false,
          facebook: false,
          apple: false,
        },
      }),
    )
    await expect(
      createCustomerAuthClient({ baseUrl: "/api", fetcher }).getConfiguration(),
    ).resolves.toEqual(expect.objectContaining({ disabled: true }))
  })

  it("lists and selects buyer accounts through credentialed BFF paths", async () => {
    const personal = {
      id: "personal:user-1",
      name: "Personal",
      kind: "personal",
      authOrganizationId: null,
      relationshipOrganizationId: null,
      relationshipPersonId: "person-1",
      membershipId: null,
      membershipRole: null,
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          accounts: [personal],
          activeAccount: personal,
          requiresSelection: false,
          policy: {
            allowedKinds: ["personal"],
            personalSignup: "open",
            businessOnboarding: "disabled",
          },
        }),
      )
      .mockResolvedValueOnce(response({ activeAccount: personal }))
    const client = createCustomerAuthClient({ baseUrl: "/api", fetcher })

    await expect(client.listBuyerAccounts()).resolves.toEqual(
      expect.objectContaining({ activeAccount: personal }),
    )
    await expect(client.selectBuyerAccount(personal.id)).resolves.toEqual(personal)
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/auth/customer/buyer-accounts", {
      method: "GET",
      credentials: "include",
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/auth/customer/buyer-accounts/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: personal.id }),
      credentials: "include",
    })
  })

  it("surfaces the server error response", async () => {
    const client = createCustomerAuthClient({
      baseUrl: "/api",
      fetcher: async () => response({ error: "Selection is no longer available" }, 403),
    })
    await expect(client.listBuyerAccounts()).rejects.toThrow("Selection is no longer available")
  })

  it("preserves mutation response headers for SSR Set-Cookie forwarding", async () => {
    const personal = {
      id: "personal:user-1",
      name: "Personal",
      kind: "personal",
      authOrganizationId: null,
      relationshipOrganizationId: null,
      relationshipPersonId: "person-1",
      membershipId: null,
      membershipRole: null,
    }
    const client = createCustomerAuthClient({
      baseUrl: "/api",
      fetcher: async () =>
        new Response(JSON.stringify({ activeAccount: personal }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "voyant_customer_session=rotated; Path=/; HttpOnly",
          },
        }),
    })

    const result = await client.selectBuyerAccountWithResponse(personal.id)

    expect(result.data).toEqual(personal)
    expect(result.response.headers.get("set-cookie")).toContain("voyant_customer_session=rotated")
  })

  it("exposes raw Better Auth endpoints for framework sign-in proxies", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    const client = createCustomerAuthClient({ baseUrl: "/api/", fetcher })

    const result = await client.request("sign-in/email", {
      method: "POST",
      body: "{}",
    })

    expect(result.status).toBe(204)
    expect(fetcher).toHaveBeenCalledWith("/api/auth/customer/sign-in/email", {
      method: "POST",
      body: "{}",
      credentials: "include",
    })
  })
})
