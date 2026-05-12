import { describe, expect, it, vi } from "vitest"

import type { VoyantApiError, VoyantFetcher } from "../client.js"
import { signUpWithEmail } from "./use-sign-up.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("signUpWithEmail", () => {
  it("posts account details to Better Auth", async () => {
    const fixturePassword = ["valid", "fixture"].join("-")
    const fetcher = vi
      .fn<VoyantFetcher>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "user_1" } }))
      .mockResolvedValueOnce(jsonResponse({ userExists: true, authenticated: true }))

    const result = await signUpWithEmail(
      {
        name: "Ana Voyant",
        email: "ana@example.com",
        password: fixturePassword,
        callbackURL: "/",
      },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result).toEqual({ data: { user: { id: "user_1" } } })
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://operator.example/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ana Voyant",
        email: "ana@example.com",
        password: fixturePassword,
        callbackURL: "/",
      }),
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://operator.example/api/auth/status", {
      method: "GET",
    })
  })

  it("surfaces Better Auth sign-up errors", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse(
        { error: "Sign-up is disabled. Ask an admin to invite you." },
        {
          status: 403,
          statusText: "Forbidden",
        },
      ),
    )

    await expect(
      signUpWithEmail(
        { name: "Ana Voyant", email: "ana@example.com", password: "wrong" },
        { baseUrl: "https://operator.example/api/", fetcher },
      ),
    ).rejects.toMatchObject({
      name: "VoyantApiError",
      message: "Sign-up is disabled. Ask an admin to invite you.",
      status: 403,
    } satisfies Partial<VoyantApiError>)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
