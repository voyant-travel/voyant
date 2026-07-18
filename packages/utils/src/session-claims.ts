/**
 * Session Claims Cookie Utilities
 *
 * Implements signed session claims to reduce API calls in middleware.
 * Claims contain minimal session info (userId, sessionId hash) that can be
 * verified locally without database lookup.
 *
 * Security:
 * - HMAC-SHA256 signing prevents tampering
 * - 5-minute expiration ensures quick revocation
 * - HttpOnly, Secure, SameSite cookies
 * - Context-separated signing keys (HKDF-SHA256): the deployment secret
 *   (a realm-specific session-claims secret) is never used directly as an HMAC key.
 *   `signSessionClaims`/`verifySessionClaims` derive a dedicated key under
 *   the `voyant:session-claims:v1` context, so a leak of a token-signing
 *   key (or any other derived key) does not compromise sibling contexts
 *   (e.g. the cloud-admin state cookie) or the raw Better Auth secret.
 *
 * Compatible with environments that expose the standard Web Crypto API,
 * including Node.js, browsers, and Cloudflare Workers.
 */

function getWebCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto
  }

  throw new Error("No crypto implementation available")
}

export interface SessionClaims {
  userId: string
  sessionId: string // Hash/short identifier, not full session ID
  iat: number // Issued at (seconds since epoch)
  exp: number // Expiration (seconds since epoch)
}

const CLAIMS_EXPIRY_SECONDS = 5 * 60 // 5 minutes

/**
 * HKDF context label under which session-claims bearer tokens are signed.
 * Bumping the version suffix invalidates all outstanding tokens.
 */
export const SESSION_CLAIMS_KEY_CONTEXT = "voyant:session-claims:v1"

/**
 * HKDF context label for the Voyant Cloud admin-auth state-cookie HMAC key.
 * The cloud broker derives this internally from the admin claims root secret.
 */
export const CLOUD_STATE_COOKIE_KEY_CONTEXT = "voyant:cloud-state-cookie:v1"

/**
 * Fixed, public HKDF salt. Domain separation comes from the `info` (context)
 * parameter; the salt only needs to be a stable application-wide constant.
 */
const HKDF_SALT = "voyant:hkdf:salt:v1"

const derivedKeyCache = new Map<string, Promise<string>>()

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/**
 * Derive a context-separated subkey from a root secret via HKDF-SHA256
 * (Web Crypto, Workers-compatible).
 *
 * The same root secret yields independent keys per context label, so a
 * compromise of one derived key cannot be replayed against another context
 * or against anything still using the root secret (e.g. Better Auth).
 *
 * @param secret - Realm-specific session-claims root secret
 * @param context - Context label, e.g. `"voyant:session-claims:v1"`
 * @returns base64url-encoded 256-bit key (43 chars — satisfies >=32-char
 *   secret checks downstream)
 */
export function deriveContextKey(secret: string, context: string): Promise<string> {
  const cacheKey = `${context}\u0000${secret}`
  let cached = derivedKeyCache.get(cacheKey)
  if (!cached) {
    cached = deriveContextKeyUncached(secret, context).catch((error: unknown) => {
      // Don't cache failures (e.g. transient crypto unavailability).
      derivedKeyCache.delete(cacheKey)
      throw error
    })
    derivedKeyCache.set(cacheKey, cached)
  }
  return cached
}

async function deriveContextKeyUncached(secret: string, context: string): Promise<string> {
  const webCrypto = getWebCrypto()
  const encoder = new TextEncoder()
  const keyMaterial = await webCrypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveBits"],
  )
  const bits = await webCrypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(HKDF_SALT),
      info: encoder.encode(context),
    },
    keyMaterial,
    256,
  )
  return base64UrlEncode(new Uint8Array(bits))
}

async function hmacBase64Url(message: string, key: string): Promise<string> {
  const webCrypto = getWebCrypto()
  const encoder = new TextEncoder()
  const cryptoKey = await webCrypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuffer = await webCrypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message))
  return base64UrlEncode(new Uint8Array(sigBuffer))
}

/**
 * Create a short identifier from session ID for inclusion in claims
 * Uses first 16 chars of base64url-encoded SHA-256 hash
 */
async function hashSessionId(sessionId: string): Promise<string> {
  const webCrypto = getWebCrypto()
  const encoder = new TextEncoder()
  const data = encoder.encode(sessionId)
  const hashBuffer = await webCrypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(hashBuffer)).slice(0, 16)
}

/**
 * Sign session claims and return as JWT-like token
 *
 * Format: base64url(header).base64url(payload).base64url(signature)
 *
 * The HMAC key is NOT the raw `secret`: it is derived via
 * `deriveContextKey(secret, SESSION_CLAIMS_KEY_CONTEXT)` so the root secret
 * is never used directly as a token-signing key (context separation).
 *
 * @param userId - User ID from verified session
 * @param sessionId - Full session ID (will be hashed)
 * @param secret - Root secret; the signing key is derived from it
 * @returns Signed token string
 */
export async function signSessionClaims(
  userId: string,
  sessionId: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + CLAIMS_EXPIRY_SECONDS

  const sessionIdHash = await hashSessionId(sessionId)
  const claims: SessionClaims = {
    userId,
    sessionId: sessionIdHash,
    iat: now,
    exp,
  }

  // Encode payload (works in both environments)
  const header = { alg: "HS256", typ: "JWT" }
  const encoder = new TextEncoder()
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(claims)))

  // Create signature with the context-derived key
  const message = `${headerB64}.${payloadB64}`
  const signingKey = await deriveContextKey(secret, SESSION_CLAIMS_KEY_CONTEXT)
  const signature = await hmacBase64Url(message, signingKey)

  return `${headerB64}.${payloadB64}.${signature}`
}

/**
 * Verify and decode session claims token
 *
 * Verification uses the same context-derived key as `signSessionClaims`
 * (`SESSION_CLAIMS_KEY_CONTEXT`), so tokens signed with the raw secret
 * (pre context-separation) are rejected.
 *
 * @param token - Signed token from cookie
 * @param secret - Root secret; the verification key is derived from it
 * @returns Decoded claims if valid, null if invalid/expired
 */
export async function verifySessionClaims(
  token: string,
  secret: string,
): Promise<SessionClaims | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return null
    }

    const [headerB64, payloadB64, signature] = parts

    // Ensure all parts are defined
    if (!headerB64 || !payloadB64 || !signature) {
      return null
    }

    // Verify signature with the context-derived key
    const message = `${headerB64}.${payloadB64}`
    const signingKey = await deriveContextKey(secret, SESSION_CLAIMS_KEY_CONTEXT)
    const expectedSig = await hmacBase64Url(message, signingKey)

    // Constant-time comparison
    if (!constantTimeEqual(signature, expectedSig)) {
      return null
    }

    // Decode payload (works in both environments)
    // base64url decode: replace - with +, _ with /, then decode
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    const payload = JSON.parse(payloadJson) as SessionClaims

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }

    // Validate structure
    if (!payload.userId || !payload.sessionId || !payload.iat || !payload.exp) {
      return null
    }

    return payload
  } catch (_error) {
    // Invalid token format or JSON parse error
    return null
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
