import { describe, expect, it, vi } from "vitest"

import {
  type BetterAuthApiTokenManagement,
  handleApiTokenManagementRequest,
} from "../../src/server.js"

function createAuthMock(): BetterAuthApiTokenManagement {
  return {
    api: {
      getSession: vi.fn(async () => ({ user: { id: "user_123" } })),
      listApiKeys: vi.fn(async () => ({ apiKeys: [], total: 0, limit: 25, offset: 0 })),
      createApiKey: vi.fn(async ({ body }) => ({
        id: "key_123",
        key: "voy_secret",
        createdAt: "2026-05-11T00:00:00.000Z",
        ...body,
      })),
      updateApiKey: vi.fn(async ({ body }) => ({
        id: body.keyId,
        createdAt: "2026-05-11T00:00:00.000Z",
        ...body,
      })),
      deleteApiKey: vi.fn(async () => ({ success: true })),
    },
  }
}

async function responseJson(response: Response | null): Promise<unknown> {
  expect(response).not.toBeNull()
  return response?.json()
}

describe("handleApiTokenManagementRequest", () => {
  it("returns null for requests outside the facade", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/session"),
      auth,
    )

    expect(response).toBeNull()
    expect(auth.api.listApiKeys).not.toHaveBeenCalled()
  })

  it("lists API tokens through Better Auth's server API", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request(
        "https://example.com/auth/api-tokens?limit=10&offset=20&sortBy=createdAt&sortDirection=desc",
      ),
      auth,
    )

    expect(response?.status).toBe(200)
    expect(await responseJson(response)).toEqual({ apiKeys: [], total: 0, limit: 25, offset: 0 })
    expect(auth.api.listApiKeys).toHaveBeenCalledWith({
      query: { limit: 10, offset: 20, sortBy: "createdAt", sortDirection: "desc" },
      headers: expect.any(Headers),
    })
  })

  it("supports custom auth base paths", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/api/auth/api-tokens"),
      auth,
      { basePath: "/api/auth" },
    )

    expect(response?.status).toBe(200)
    expect(auth.api.listApiKeys).toHaveBeenCalled()
  })

  it("attaches the session user id when creating permissioned API tokens", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/api-tokens", {
        method: "POST",
        body: JSON.stringify({
          name: "CMS sync",
          permissions: { products: ["read"] },
          remaining: 100,
          ignored: true,
        }),
      }),
      auth,
    )

    expect(response?.status).toBe(201)
    expect(auth.api.getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) })
    expect(auth.api.createApiKey).toHaveBeenCalledWith({
      body: {
        name: "CMS sync",
        permissions: { products: ["read"] },
        remaining: 100,
        userId: "user_123",
      },
    })
    expect(await responseJson(response)).toMatchObject({
      id: "key_123",
      name: "CMS sync",
      userId: "user_123",
    })
  })

  it("attaches key id and session user id when updating API tokens", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/api-tokens/key%20123", {
        method: "POST",
        body: JSON.stringify({ enabled: false, permissions: { catalog: ["search"] } }),
      }),
      auth,
    )

    expect(response?.status).toBe(200)
    expect(auth.api.updateApiKey).toHaveBeenCalledWith({
      body: {
        enabled: false,
        permissions: { catalog: ["search"] },
        keyId: "key 123",
        userId: "user_123",
      },
    })
  })

  it("deletes API tokens with the request session headers", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/api-tokens/key_123", {
        method: "DELETE",
        body: JSON.stringify({ configId: "default" }),
      }),
      auth,
    )

    expect(response?.status).toBe(200)
    expect(await responseJson(response)).toEqual({ success: true })
    expect(auth.api.deleteApiKey).toHaveBeenCalledWith({
      body: { configId: "default", keyId: "key_123" },
      headers: expect.any(Headers),
    })
  })

  it("normalizes missing sessions to 401 responses", async () => {
    const auth = createAuthMock()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/api-tokens", {
        method: "POST",
        body: JSON.stringify({ name: "CMS sync", permissions: { products: ["read"] } }),
      }),
      auth,
    )

    expect(response?.status).toBe(401)
    expect(await responseJson(response)).toEqual({ error: "Unauthorized" })
    expect(auth.api.createApiKey).not.toHaveBeenCalled()
  })

  it("returns 405 for facade paths with unsupported methods", async () => {
    const auth = createAuthMock()
    const response = await handleApiTokenManagementRequest(
      new Request("https://example.com/auth/api-tokens", { method: "PATCH" }),
      auth,
    )

    expect(response?.status).toBe(405)
    expect(response?.headers.get("Allow")).toBe("GET, POST")
    expect(await responseJson(response)).toEqual({ error: "Method not allowed" })
  })
})
