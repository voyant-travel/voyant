import { describe, expect, it, vi } from "vitest"

import type { VoyantApiError, VoyantFetcher } from "../client.js"
import { confirmPasswordReset, requestPasswordReset } from "./use-password-reset.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("password reset helpers", () => {
  it("posts password reset requests to Better Auth", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ status: true }))

    const result = await requestPasswordReset(
      {
        email: "ana@example.com",
        redirectTo: "https://operator.example/reset-password",
      },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result).toEqual({ data: { status: true } })
    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/auth/request-password-reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ana@example.com",
          redirectTo: "https://operator.example/reset-password",
        }),
      },
    )
  })

  it("posts password reset confirmation tokens to Better Auth", async () => {
    const fixtureResetToken = ["reset", "fixture"].join("-")
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ status: true }))

    const result = await confirmPasswordReset(
      {
        token: fixtureResetToken,
        newPassword: "correct-horse-battery",
      },
      { baseUrl: "https://operator.example/api/", fetcher },
    )

    expect(result).toEqual({ data: { status: true } })
    expect(fetcher).toHaveBeenCalledWith("https://operator.example/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: fixtureResetToken,
        newPassword: "correct-horse-battery",
      }),
    })
  })

  it("surfaces Better Auth reset errors", async () => {
    const fixtureExpiredToken = ["expired", "fixture"].join("-")
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Invalid token" } },
        {
          status: 400,
          statusText: "Bad Request",
        },
      ),
    )

    await expect(
      confirmPasswordReset(
        { token: fixtureExpiredToken, newPassword: "correct-horse-battery" },
        { baseUrl: "https://operator.example/api", fetcher },
      ),
    ).rejects.toMatchObject({
      name: "VoyantApiError",
      message: "Invalid token",
      status: 400,
    } satisfies Partial<VoyantApiError>)
  })
})
