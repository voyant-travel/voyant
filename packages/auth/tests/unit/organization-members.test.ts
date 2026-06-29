import { describe, expect, it, vi } from "vitest"

import {
  type BetterAuthApiTokenManagement,
  handleOrganizationMembersRequest,
} from "../../src/server.js"

function createAuthMock(): BetterAuthApiTokenManagement {
  return {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "user_123" },
        session: { id: "session_123", activeOrganizationId: "org_active" },
      })),
      listApiKeys: vi.fn(),
      createApiKey: vi.fn(),
      updateApiKey: vi.fn(),
      deleteApiKey: vi.fn(),
    },
  }
}

async function responseJson(response: Response | null): Promise<unknown> {
  expect(response).not.toBeNull()
  return response?.json()
}

describe("handleOrganizationMembersRequest", () => {
  it("returns null for requests outside the organization members facade", async () => {
    const auth = createAuthMock()
    const listOrganizationMembers = vi.fn()

    const response = await handleOrganizationMembersRequest(
      new Request("https://example.com/auth/session"),
      auth,
      {
        db: {} as never,
        listOrganizationMembers,
      },
    )

    expect(response).toBeNull()
    expect(listOrganizationMembers).not.toHaveBeenCalled()
  })

  it("lists organization members for the signed-in user's active organization", async () => {
    const auth = createAuthMock()
    const listOrganizationMembers = vi.fn(async () => [
      {
        id: "member_123",
        userId: "user_123",
        organizationId: "org_active",
        role: "owner",
        createdAt: "2026-06-01T00:00:00.000Z",
        user: {
          id: "user_123",
          email: "owner@example.com",
          name: "Owner User",
          image: null,
        },
      },
    ])

    const response = await handleOrganizationMembersRequest(
      new Request("https://example.com/auth/organization/list-members"),
      auth,
      {
        db: {} as never,
        listOrganizationMembers,
      },
    )

    expect(response?.status).toBe(200)
    expect(auth.api.getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) })
    expect(listOrganizationMembers).toHaveBeenCalledWith(
      {},
      {
        userId: "user_123",
        sessionId: "session_123",
        activeOrganizationId: "org_active",
        organizationId: undefined,
      },
    )
    expect(await responseJson(response)).toEqual({
      members: [
        {
          id: "member_123",
          userId: "user_123",
          organizationId: "org_active",
          role: "owner",
          createdAt: "2026-06-01T00:00:00.000Z",
          user: {
            id: "user_123",
            email: "owner@example.com",
            name: "Owner User",
            image: null,
          },
        },
      ],
    })
  })

  it("passes an explicit organization filter and supports custom auth base paths", async () => {
    const auth = createAuthMock()
    const listOrganizationMembers = vi.fn(async () => [])

    const response = await handleOrganizationMembersRequest(
      new Request("https://example.com/api/auth/organization/list-members?organizationId=org_123"),
      auth,
      {
        basePath: "/api/auth",
        db: {} as never,
        listOrganizationMembers,
      },
    )

    expect(response?.status).toBe(200)
    expect(listOrganizationMembers).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ organizationId: "org_123" }),
    )
  })

  it("normalizes missing sessions to 401 responses", async () => {
    const auth = createAuthMock()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await handleOrganizationMembersRequest(
      new Request("https://example.com/auth/organization/list-members"),
      auth,
      {
        db: {} as never,
        listOrganizationMembers: vi.fn(),
      },
    )

    expect(response?.status).toBe(401)
    expect(await responseJson(response)).toEqual({ error: "Unauthorized" })
  })

  it("rejects unsupported methods", async () => {
    const auth = createAuthMock()
    const listOrganizationMembers = vi.fn()

    const response = await handleOrganizationMembersRequest(
      new Request("https://example.com/auth/organization/list-members", { method: "POST" }),
      auth,
      {
        db: {} as never,
        listOrganizationMembers,
      },
    )

    expect(response?.status).toBe(405)
    expect(response?.headers.get("Allow")).toBe("GET")
    expect(await responseJson(response)).toEqual({ error: "Method not allowed" })
    expect(auth.api.getSession).not.toHaveBeenCalled()
    expect(listOrganizationMembers).not.toHaveBeenCalled()
  })
})
