import { describe, expect, it } from "vitest"

import {
  CLOUD_STATE_COOKIE_KEY_CONTEXT,
  deriveContextKey,
  SESSION_CLAIMS_KEY_CONTEXT,
  signSessionClaims,
  verifySessionClaims,
} from "../src/session-claims.js"

const SECRET = "test-secret"

describe("session claims", () => {
  it("round-trips signed claims", async () => {
    const token = await signSessionClaims("user_123", "session_456", SECRET)

    await expect(verifySessionClaims(token, SECRET)).resolves.toMatchObject({
      userId: "user_123",
    })
  })

  it("rejects tampered tokens", async () => {
    const token = await signSessionClaims("user_123", "session_456", SECRET)
    const [header, payload] = token.split(".")
    const tampered = `${header}.${payload}.invalid`

    await expect(verifySessionClaims(tampered, SECRET)).resolves.toBeNull()
  })

  it("rejects expired claims", async () => {
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const payload = base64UrlEncode(
      JSON.stringify({
        userId: "user_123",
        sessionId: "session_hash",
        iat: 1,
        exp: 1,
      }),
    )
    // Sign with the context-derived key (what signSessionClaims uses
    // internally) so this test exercises the expiry check, not the
    // signature check.
    const signingKey = await deriveContextKey(SECRET, SESSION_CLAIMS_KEY_CONTEXT)
    const signature = await signHmac(`${header}.${payload}`, signingKey)
    const expired = `${header}.${payload}.${signature}`

    await expect(verifySessionClaims(expired, SECRET)).resolves.toBeNull()
  })

  it("rejects tokens signed with the raw secret (pre context-separation format)", async () => {
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const now = Math.floor(Date.now() / 1000)
    const payload = base64UrlEncode(
      JSON.stringify({
        userId: "user_123",
        sessionId: "session_hash",
        iat: now,
        exp: now + 300,
      }),
    )
    // Legacy tokens were HMAC'd directly with the secret. They must no
    // longer verify after the HKDF context-separation change (M7).
    const signature = await signHmac(`${header}.${payload}`, SECRET)
    const legacy = `${header}.${payload}.${signature}`

    await expect(verifySessionClaims(legacy, SECRET)).resolves.toBeNull()
  })
})

describe("deriveContextKey", () => {
  it("matches the stable cloud-state derivation vector", async () => {
    await expect(
      deriveContextKey("voyant-context-key-test-secret", CLOUD_STATE_COOKIE_KEY_CONTEXT),
    ).resolves.toBe("rPIk6h3pt_BW3gSEJkzQsyUH2H_bhn11qvLWZjPLdDE")
  })

  it("is deterministic for the same secret and context", async () => {
    const a = await deriveContextKey(SECRET, SESSION_CLAIMS_KEY_CONTEXT)
    const b = await deriveContextKey(SECRET, SESSION_CLAIMS_KEY_CONTEXT)

    expect(a).toBe(b)
  })

  it("produces independent keys per context", async () => {
    const claims = await deriveContextKey(SECRET, SESSION_CLAIMS_KEY_CONTEXT)
    const cookie = await deriveContextKey(SECRET, CLOUD_STATE_COOKIE_KEY_CONTEXT)

    expect(claims).not.toBe(cookie)
  })

  it("produces different keys for different secrets", async () => {
    const a = await deriveContextKey("secret-a", SESSION_CLAIMS_KEY_CONTEXT)
    const b = await deriveContextKey("secret-b", SESSION_CLAIMS_KEY_CONTEXT)

    expect(a).not.toBe(b)
  })

  it("never equals the raw secret and satisfies >=32-char secret checks", async () => {
    const key = await deriveContextKey(SECRET, SESSION_CLAIMS_KEY_CONTEXT)

    expect(key).not.toBe(SECRET)
    // 256 bits base64url-encoded without padding = 43 chars
    expect(key).toHaveLength(43)
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function signHmac(message: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}
