import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export const APP_ACCESS_TOKEN_PREFIX = "vapp_"
export const APP_REFRESH_TOKEN_PREFIX = "vappr_"
export const APP_AUTH_CODE_PREFIX = "vappc_"

export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url")
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = Buffer.from(sha256Hex(left), "hex")
  const rightHash = Buffer.from(sha256Hex(right), "hex")
  return timingSafeEqual(leftHash, rightHash)
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false
  return constantTimeEqual(sha256Base64Url(verifier), challenge)
}
