import { describe, expect, it, vi } from "vitest"

import type { VoyantFetcher } from "../client.js"
import { updateAccountProfile } from "./use-update-account-profile.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("updateAccountProfile", () => {
  it("patches the current user's profile fields", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse({
        id: "user_1",
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
      }),
    )

    const result = await updateAccountProfile(
      {
        firstName: "Ana",
        lastName: "Pop",
        locale: "ro",
        timezone: "Europe/Bucharest",
      },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result.firstName).toBe("Ana")
    expect(result.locale).toBe("ro")
    expect(fetcher).toHaveBeenCalledWith("https://operator.example/api/auth/me", {
      method: "PATCH",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        firstName: "Ana",
        lastName: "Pop",
        locale: "ro",
        timezone: "Europe/Bucharest",
      }),
    })
  })

  it("preserves explicit null fields in the patch body", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse({
        id: "user_1",
        email: "ana@example.com",
        firstName: null,
        lastName: null,
        locale: "en",
        timezone: null,
        isSuperAdmin: false,
        isSupportUser: false,
        createdAt: "2026-05-12T00:00:00.000Z",
      }),
    )

    await updateAccountProfile(
      { firstName: null, lastName: null, timezone: null },
      { baseUrl: "https://operator.example/api/", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith("https://operator.example/api/auth/me", {
      method: "PATCH",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ firstName: null, lastName: null, timezone: null }),
    })
  })
})
