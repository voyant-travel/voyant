import { describe, expect, it, vi } from "vitest"

import type { VoyantFetcher } from "../client.js"
import { acceptInvitation } from "./use-accept-invitation.js"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("acceptInvitation", () => {
  it("posts the invitation token to the mounted Better Auth organization endpoint", async () => {
    const invitationToken = ["invitation", "123"].join("_")
    const fetcher = vi.fn<VoyantFetcher>().mockResolvedValueOnce(jsonResponse({ success: true }))

    const result = await acceptInvitation(
      { token: invitationToken },
      { baseUrl: "https://operator.example/api", fetcher },
    )

    expect(result).toEqual({ data: { success: true } })
    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/auth/organization/accept-invitation",
      {
        method: "POST",
        body: JSON.stringify({ invitationId: invitationToken }),
        headers: expect.any(Headers),
      },
    )
  })

  it("also accepts Better Auth's invitationId field name", async () => {
    const invitationToken = ["invitation", "456"].join("_")
    const fetcher = vi
      .fn<VoyantFetcher>()
      .mockResolvedValueOnce(jsonResponse({ id: ["member", "123"].join("_") }))

    await acceptInvitation(
      { invitationId: invitationToken },
      { baseUrl: "https://operator.example/api/", fetcher },
    )

    expect(fetcher).toHaveBeenCalledWith(
      "https://operator.example/api/auth/organization/accept-invitation",
      expect.objectContaining({
        body: JSON.stringify({ invitationId: invitationToken }),
      }),
    )
  })

  it("requires a token or invitationId", async () => {
    const fetcher = vi.fn<VoyantFetcher>()

    await expect(
      acceptInvitation({ token: " " }, { baseUrl: "https://operator.example/api", fetcher }),
    ).rejects.toThrow("Invitation token is required.")
    expect(fetcher).not.toHaveBeenCalled()
  })
})
