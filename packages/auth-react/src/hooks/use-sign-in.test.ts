import { describe, expect, it, vi } from "vitest"

import type { VoyantApiError, VoyantFetcher } from "../client.js"
import { signInWithEmail } from "./use-sign-in.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("signInWithEmail", () => {
  it("posts credentials to Better Auth and provisions the Voyant profile", async () => {
    const fixturePassword = ["valid", "fixture"].join("-")
    const fetcher = vi
      .fn<VoyantFetcher>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "user_1" } }))
      .mockResolvedValueOnce(jsonResponse({ userExists: true, authenticated: true }))

    const result = await signInWithEmail(
      {
        email: "ana@example.com",
        password: fixturePassword,
        callbackURL: "/bookings",
        rememberMe: true,
      },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result).toEqual({ data: { user: { id: "user_1" } } })
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://operator.example/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "ana@example.com",
        password: fixturePassword,
        callbackURL: "/bookings",
        rememberMe: true,
      }),
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://operator.example/api/auth/status", {
      method: "GET",
    })
  })

  it("surfaces Better Auth error messages", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Email is not verified" } },
        {
          status: 403,
          statusText: "Forbidden",
        },
      ),
    )

    await expect(
      signInWithEmail(
        { email: "ana@example.com", password: "wrong" },
        { baseUrl: "https://operator.example/api/", fetcher },
      ),
    ).rejects.toMatchObject({
      name: "VoyantApiError",
      message: "Email is not verified",
      status: 403,
    } satisfies Partial<VoyantApiError>)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
