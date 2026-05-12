import { describe, expect, it, vi } from "vitest"

import type { VoyantFetcher } from "../client.js"
import {
  changeAccountPassword,
  confirmAccountEmailChange,
  requestAccountEmailChange,
  updateAccountProfile,
} from "./use-account-mutation.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("account mutation request helpers", () => {
  it("patches the Voyant profile endpoint", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(
      jsonResponse({
        id: "user_1",
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "Pop",
        isSuperAdmin: false,
        isSupportUser: false,
        createdAt: "2026-05-12T00:00:00.000Z",
        profilePictureUrl: null,
      }),
    )

    await updateAccountProfile(
      { firstName: "Ana", lastName: "Pop", profilePictureUrl: null },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith("https://operator.example/api/auth/me", {
      method: "PATCH",
      headers: expect.any(Headers),
      body: JSON.stringify({
        firstName: "Ana",
        lastName: "Pop",
        profilePictureUrl: null,
      }),
    })
  })

  it("posts password changes to the mounted Better Auth endpoint", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ success: true }))

    await changeAccountPassword(
      {
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      },
      { baseUrl: "https://operator.example/api/", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith("https://operator.example/api/auth/change-password", {
      method: "POST",
      headers: expect.any(Headers),
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      }),
    })
  })

  it("posts email-change requests to the Email OTP endpoint", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ success: true }))

    await requestAccountEmailChange(
      { newEmail: "new@example.com" },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/auth/email-otp/request-email-change",
      {
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({ newEmail: "new@example.com" }),
      },
    )
  })

  it("posts email-change confirmations to the Email OTP endpoint", async () => {
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ success: true }))

    await confirmAccountEmailChange(
      { newEmail: "new@example.com", otp: "123456" },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/auth/email-otp/change-email",
      {
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({ newEmail: "new@example.com", otp: "123456" }),
      },
    )
  })
})
