import { describe, expect, it, vi } from "vitest"

import { type BetterAuthApiTokenManagement, handleAccountProfileRequest } from "../../src/server.js"

function createAuthMock(): BetterAuthApiTokenManagement {
  return {
    api: {
      getSession: vi.fn(async () => ({ user: { id: "user_123" } })),
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

describe("handleAccountProfileRequest", () => {
  it("returns null for requests outside the profile facade", async () => {
    const auth = createAuthMock()
    const updateProfile = vi.fn()

    const response = await handleAccountProfileRequest(
      new Request("https://example.com/auth/session"),
      auth,
      {
        db: {} as never,
        updateProfile,
      },
    )

    expect(response).toBeNull()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("patches the signed-in user's profile", async () => {
    const auth = createAuthMock()
    const updateProfile = vi.fn(async () => ({
      id: "user_123",
      email: "ana@example.com",
      phoneNumber: null,
      firstName: "Ana",
      lastName: "Pop",
      locale: "ro",
      timezone: "Europe/Bucharest",
      isSuperAdmin: false,
      isSupportUser: false,
      createdAt: "2026-05-12T00:00:00.000Z",
      profilePictureUrl: null,
    }))

    const response = await handleAccountProfileRequest(
      new Request("https://example.com/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: "Ana",
          lastName: "Pop",
          locale: "ro",
          timezone: "Europe/Bucharest",
          ignored: true,
        }),
      }),
      auth,
      {
        db: {} as never,
        updateProfile,
      },
    )

    expect(response?.status).toBe(200)
    expect(auth.api.getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) })
    expect(updateProfile).toHaveBeenCalledWith(
      {},
      {
        userId: "user_123",
        firstName: "Ana",
        lastName: "Pop",
        locale: "ro",
        timezone: "Europe/Bucharest",
      },
    )
    expect(await responseJson(response)).toMatchObject({
      id: "user_123",
      firstName: "Ana",
      locale: "ro",
    })
  })

  it("supports custom auth base paths", async () => {
    const auth = createAuthMock()
    const updateProfile = vi.fn(async () => ({
      id: "user_123",
      email: "ana@example.com",
      firstName: null,
      lastName: null,
      locale: "en",
      timezone: null,
      isSuperAdmin: false,
      isSupportUser: false,
      createdAt: "2026-05-12T00:00:00.000Z",
    }))

    const response = await handleAccountProfileRequest(
      new Request("https://example.com/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName: null }),
      }),
      auth,
      {
        basePath: "/api/auth",
        db: {} as never,
        updateProfile,
      },
    )

    expect(response?.status).toBe(200)
    expect(updateProfile).toHaveBeenCalled()
  })

  it("normalizes missing sessions to 401 responses", async () => {
    const auth = createAuthMock()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await handleAccountProfileRequest(
      new Request("https://example.com/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Ana" }),
      }),
      auth,
      {
        db: {} as never,
        updateProfile: vi.fn(),
      },
    )

    expect(response?.status).toBe(401)
    expect(await responseJson(response)).toEqual({ error: "Unauthorized" })
  })

  it("lets non-PATCH profile facade requests fall through", async () => {
    const auth = createAuthMock()
    const updateProfile = vi.fn()

    const response = await handleAccountProfileRequest(
      new Request("https://example.com/auth/me", { method: "POST" }),
      auth,
      {
        db: {} as never,
        updateProfile,
      },
    )

    expect(response).toBeNull()
    expect(auth.api.getSession).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("rejects invalid profile fields", async () => {
    const auth = createAuthMock()
    const updateProfile = vi.fn()

    const invalidResponse = await handleAccountProfileRequest(
      new Request("https://example.com/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ locale: "x".repeat(11) }),
      }),
      auth,
      {
        db: {} as never,
        updateProfile,
      },
    )

    expect(invalidResponse?.status).toBe(400)
    expect(await responseJson(invalidResponse)).toEqual({
      error: "locale must be 10 characters or fewer",
    })
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
