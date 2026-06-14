import { verifySessionClaims } from "@voyant-travel/utils/session-claims"

export interface SessionAuthContext {
  userId: string
  sessionId?: string
}

export async function verifySession(token: string, secretKey: string): Promise<SessionAuthContext> {
  const payload = await verifySessionClaims(token, secretKey)

  if (!payload) {
    throw new Error("Invalid or expired token")
  }

  return {
    userId: payload.userId,
    sessionId: payload.sessionId,
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null

  const parts = authHeader.trim().split(/\s+/)
  if (parts.length !== 2) return null

  const scheme = parts[0]
  const token = parts[1]
  if (!scheme || !token || !/^bearer$/i.test(scheme)) return null

  return token
}
