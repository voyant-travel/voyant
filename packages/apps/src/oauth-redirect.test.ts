import { describe, expect, it } from "vitest"
import { appOAuthAuthorizeQuerySchema } from "./contracts.js"
import { buildAppOAuthCallbackUrl } from "./oauth-redirect.js"

const request = {
  response_type: "code",
  client_id: "app_smartbill",
  release_id: "release_smartbill_1",
  redirect_uri: "https://voyant-smartbill-app-dev.pixelmakers.io/v1/setup/oauth/callback",
  state: "state_1",
  code_challenge: "challenge_1",
  code_challenge_method: "S256",
} as const

describe("app OAuth callback binding", () => {
  it("accepts and echoes an app-generated nonce", () => {
    const nonce = "n".repeat(43)
    const parsed = appOAuthAuthorizeQuerySchema.parse({ ...request, nonce })
    const redirect = buildAppOAuthCallbackUrl({
      redirectUri: parsed.redirect_uri,
      code: "authorization_code_1",
      state: parsed.state,
      nonce: parsed.nonce,
    })

    expect(redirect.searchParams.get("code")).toBe("authorization_code_1")
    expect(redirect.searchParams.get("state")).toBe("state_1")
    expect(redirect.searchParams.get("nonce")).toBe(nonce)
  })

  it("keeps nonce optional for OAuth clients that use state and PKCE only", () => {
    const parsed = appOAuthAuthorizeQuerySchema.parse(request)
    const redirect = buildAppOAuthCallbackUrl({
      redirectUri: parsed.redirect_uri,
      code: "authorization_code_1",
      state: parsed.state,
    })

    expect(redirect.searchParams.has("nonce")).toBe(false)
  })

  it("rejects short nonce values", () => {
    expect(() => appOAuthAuthorizeQuerySchema.parse({ ...request, nonce: "short" })).toThrow()
  })
})
