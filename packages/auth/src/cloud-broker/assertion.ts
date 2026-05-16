import type { CloudAdminAuthState } from "./state.js"
import { base64UrlDecode, isRecord, normalizeAbsoluteUrl, toArrayBuffer } from "./utils.js"

export const VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER = "https://api.voyantjs.com"

export type CloudAdminAssertion = {
  iss: typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER
  aud: string
  sub: string
  email: string
  emailVerified: boolean
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  workosUserId: string
  workosOrganizationId: string
  platformOrganizationId: string
  platformOrganizationSlug: string
  deploymentId: string
  appId?: string | null
  environment?: string | null
  membershipId?: string | null
  roleSlug?: string | null
  roleName?: string | null
  surfaces?: string[] | null
  nonce: string
  iat: number
  exp: number
}

export type CloudAdminAuthExchangeConfig = {
  exchangeUrl: string
  deploymentId: string
  clientToken: string
  assertionJwksUrl: string
  assertionAudience: string
  assertionIssuer?: typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER
}

export type CloudAdminAuthRevalidateConfig = {
  revalidateUrl: string
  deploymentId: string
  clientToken: string
}

export type ExchangeCloudAdminAuthCodeInput = {
  code: string
  state: CloudAdminAuthState
  config: CloudAdminAuthExchangeConfig
  fetch?: typeof fetch
  now?: Date
}

export type RevalidateCloudAdminAuthAccessInput = {
  workosUserId: string
  config: CloudAdminAuthRevalidateConfig
  fetch?: typeof fetch
}

export type CloudAdminAuthRevalidationResult = {
  ok: boolean
  status: "active" | "revoked"
  reason?: string
}

type JwsHeader = {
  alg: "RS256"
  kid: string
  typ?: string
}

type JsonWebKeySet = {
  keys: JwksKey[]
}

type JwksKey = JsonWebKey & {
  kid?: string
  kty?: string
}

export async function exchangeCloudAdminAuthCode({
  code,
  state,
  config,
  fetch: fetchFn = fetch,
  now = new Date(),
}: ExchangeCloudAdminAuthCodeInput): Promise<CloudAdminAssertion> {
  validateExchangeConfig(config)

  const response = await fetchFn(config.exchangeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.clientToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      deploymentId: config.deploymentId,
      redirectUri: state.redirectUri,
      nonce: state.nonce,
    }),
  })

  if (!response.ok) {
    throw new Error(`Voyant Cloud auth exchange failed with HTTP ${response.status}`)
  }

  const body = (await response.json()) as unknown
  if (!isRecord(body) || typeof body.assertion !== "string") {
    throw new Error("Voyant Cloud auth exchange response is missing assertion")
  }

  return verifyCloudAdminAssertion(body.assertion, {
    jwksUrl: config.assertionJwksUrl,
    issuer: config.assertionIssuer ?? VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER,
    audience: config.assertionAudience,
    deploymentId: config.deploymentId,
    nonce: state.nonce,
    fetch: fetchFn,
    now,
  })
}

export async function revalidateCloudAdminAuthAccess({
  workosUserId,
  config,
  fetch: fetchFn = fetch,
}: RevalidateCloudAdminAuthAccessInput): Promise<CloudAdminAuthRevalidationResult> {
  validateRevalidateConfig(config)

  const response = await fetchFn(config.revalidateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.clientToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deploymentId: config.deploymentId,
      workosUserId,
    }),
  })

  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok && response.status !== 403) {
    throw new Error(`Voyant Cloud auth revalidation failed with HTTP ${response.status}`)
  }

  if (
    !isRecord(body) ||
    typeof body.ok !== "boolean" ||
    (body.status !== "active" && body.status !== "revoked")
  ) {
    throw new Error("Voyant Cloud auth revalidation response is invalid")
  }

  return {
    ok: body.ok,
    status: body.status,
    reason: optionalString(body.reason) ?? undefined,
  }
}

export async function verifyCloudAdminAssertion(
  assertion: string,
  options: {
    jwksUrl: string
    issuer: typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER
    audience: string
    deploymentId: string
    nonce: string
    fetch?: typeof fetch
    now?: Date
  },
): Promise<CloudAdminAssertion> {
  const { header, payload, signingInput, signature } = parseCompactJws(assertion)
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported Voyant Cloud auth assertion algorithm: ${header.alg}`)
  }

  const jwk = await fetchJwksKey(options.jwksUrl, header.kid, options.fetch ?? fetch)
  const key = await globalThis.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  )
  const verified = await globalThis.crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    toArrayBuffer(signature),
    toArrayBuffer(new TextEncoder().encode(signingInput)),
  )
  if (!verified) {
    throw new Error("Invalid Voyant Cloud auth assertion signature")
  }

  const assertionPayload = parseCloudAdminAssertionPayload(payload)
  validateCloudAdminAssertionClaims(assertionPayload, {
    issuer: options.issuer,
    audience: options.audience,
    deploymentId: options.deploymentId,
    nonce: options.nonce,
    now: options.now ?? new Date(),
  })
  return assertionPayload
}

function validateExchangeConfig(config: CloudAdminAuthExchangeConfig): void {
  normalizeAbsoluteUrl(config.exchangeUrl, "exchangeUrl")
  normalizeAbsoluteUrl(config.assertionJwksUrl, "assertionJwksUrl")

  if (!config.deploymentId.trim()) {
    throw new Error("Voyant Cloud auth exchange requires deploymentId")
  }
  if (!config.clientToken.trim()) {
    throw new Error("Voyant Cloud auth exchange requires clientToken")
  }
  if (!config.assertionAudience.trim()) {
    throw new Error("Voyant Cloud auth exchange requires assertionAudience")
  }
}

function validateRevalidateConfig(config: CloudAdminAuthRevalidateConfig): void {
  normalizeAbsoluteUrl(config.revalidateUrl, "revalidateUrl")

  if (!config.deploymentId.trim()) {
    throw new Error("Voyant Cloud auth revalidation requires deploymentId")
  }
  if (!config.clientToken.trim()) {
    throw new Error("Voyant Cloud auth revalidation requires clientToken")
  }
}

function parseCompactJws(assertion: string): {
  header: JwsHeader
  payload: unknown
  signingInput: string
  signature: Uint8Array
} {
  const [encodedHeader, encodedPayload, encodedSignature, ...rest] = assertion.split(".")
  if (!encodedHeader || !encodedPayload || !encodedSignature || rest.length > 0) {
    throw new Error("Voyant Cloud auth assertion must be a compact JWS")
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader))) as unknown
  if (!isRecord(header) || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Voyant Cloud auth assertion header is invalid")
  }

  return {
    header: { alg: header.alg, kid: header.kid, typ: optionalString(header.typ) ?? undefined },
    payload: JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as unknown,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: base64UrlDecode(encodedSignature),
  }
}

async function fetchJwksKey(jwksUrl: string, kid: string, fetchFn: typeof fetch): Promise<JwksKey> {
  const response = await fetchFn(jwksUrl)
  if (!response.ok) {
    throw new Error(`Voyant Cloud auth JWKS fetch failed with HTTP ${response.status}`)
  }

  const body = (await response.json()) as unknown
  if (!isJsonWebKeySet(body)) {
    throw new Error("Voyant Cloud auth JWKS response is invalid")
  }

  const key = body.keys.find((candidate) => candidate.kid === kid)
  if (!key) {
    throw new Error("Voyant Cloud auth assertion key was not found in JWKS")
  }
  if (key.kty !== "RSA") {
    throw new Error("Voyant Cloud auth assertion key must be RSA")
  }
  return key
}

function parseCloudAdminAssertionPayload(payload: unknown): CloudAdminAssertion {
  if (!isRecord(payload)) {
    throw new Error("Voyant Cloud auth assertion payload is invalid")
  }

  return {
    iss: payload.iss as typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER,
    aud: requiredString(payload.aud, "aud"),
    sub: requiredString(payload.sub, "sub"),
    email: requiredString(payload.email, "email"),
    emailVerified: requiredBoolean(payload.emailVerified, "emailVerified"),
    name: optionalString(payload.name),
    firstName: optionalString(payload.firstName),
    lastName: optionalString(payload.lastName),
    image: optionalString(payload.image),
    workosUserId: requiredString(payload.workosUserId, "workosUserId"),
    workosOrganizationId: requiredString(payload.workosOrganizationId, "workosOrganizationId"),
    platformOrganizationId: requiredString(
      payload.platformOrganizationId,
      "platformOrganizationId",
    ),
    platformOrganizationSlug: requiredString(
      payload.platformOrganizationSlug,
      "platformOrganizationSlug",
    ),
    deploymentId: requiredString(payload.deploymentId, "deploymentId"),
    appId: optionalString(payload.appId),
    environment: optionalString(payload.environment),
    membershipId: optionalString(payload.membershipId),
    roleSlug: optionalString(payload.roleSlug),
    roleName: optionalString(payload.roleName),
    surfaces: optionalStringArray(payload.surfaces),
    nonce: requiredString(payload.nonce, "nonce"),
    iat: requiredNumber(payload.iat, "iat"),
    exp: requiredNumber(payload.exp, "exp"),
  }
}

function validateCloudAdminAssertionClaims(
  assertion: CloudAdminAssertion,
  expected: {
    issuer: typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER
    audience: string
    deploymentId: string
    nonce: string
    now: Date
  },
): void {
  const nowSeconds = Math.floor(expected.now.getTime() / 1000)

  if (assertion.iss !== expected.issuer) {
    throw new Error("Voyant Cloud auth assertion issuer mismatch")
  }
  if (assertion.aud !== expected.audience) {
    throw new Error("Voyant Cloud auth assertion audience mismatch")
  }
  if (assertion.deploymentId !== expected.deploymentId) {
    throw new Error("Voyant Cloud auth assertion deployment mismatch")
  }
  if (assertion.nonce !== expected.nonce) {
    throw new Error("Voyant Cloud auth assertion nonce mismatch")
  }
  if (assertion.exp <= nowSeconds) {
    throw new Error("Voyant Cloud auth assertion is expired")
  }
  if (assertion.iat > nowSeconds + 60) {
    throw new Error("Voyant Cloud auth assertion iat is in the future")
  }
}

function isJsonWebKeySet(value: unknown): value is JsonWebKeySet {
  return isRecord(value) && Array.isArray(value.keys) && value.keys.every(isJwksKey)
}

function isJwksKey(value: unknown): value is JwksKey {
  return isRecord(value) && typeof value.kid === "string" && typeof value.kty === "string"
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Voyant Cloud auth assertion ${field} must be a string`)
  }
  return value
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Voyant Cloud auth assertion ${field} must be a boolean`)
  }
  return value
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Voyant Cloud auth assertion ${field} must be a number`)
  }
  return value
}

function optionalStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Voyant Cloud auth assertion surfaces must be an array of strings")
  }
  return value
}
