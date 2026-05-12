import { describe, expect, it, vi } from "vitest"

import type { VoyantApiError, VoyantFetcher } from "../client.js"
import { verifyEmail } from "./use-verify-email.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("verifyEmail", () => {
  it("verifies token links through the mounted Better Auth endpoint", async () => {
    const emailLinkFixture = "email-link-fixture"
    const fetcher = vi
      .fn<VoyantFetcher>()
      .mockResolvedValueOnce(jsonResponse({ status: true }))
      .mockResolvedValueOnce(jsonResponse({ userExists: true, authenticated: true }))

    const result = await verifyEmail(
      { token: emailLinkFixture },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result).toEqual({ data: { status: true } })
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `https://operator.example/api/auth/verify-email?token=${emailLinkFixture}`,
      { method: "GET" },
    )
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://operator.example/api/auth/status", {
      method: "GET",
    })
  })

  it("verifies email OTP codes through the Better Auth email OTP plugin", async () => {
    const fetcher = vi
      .fn<VoyantFetcher>()
      .mockResolvedValueOnce(jsonResponse({ status: true }))
      .mockResolvedValueOnce(jsonResponse({ userExists: true, authenticated: true }))

    await verifyEmail(
      { email: "ana@example.com", otp: "123456" },
      { baseUrl: "https://operator.example/api/", fetcher },
    )

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://operator.example/api/auth/email-otp/verify-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ana@example.com",
          otp: "123456",
        }),
      },
    )
  })

  it("surfaces Better Auth verification errors", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "Invalid verification code" } },
        {
          status: 400,
          statusText: "Bad Request",
        },
      ),
    )

    await expect(
      verifyEmail(
        { email: "ana@example.com", otp: "000000" },
        { baseUrl: "https://operator.example/api", fetcher },
      ),
    ).rejects.toMatchObject({
      name: "VoyantApiError",
      message: "Invalid verification code",
      status: 400,
    } satisfies Partial<VoyantApiError>)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
