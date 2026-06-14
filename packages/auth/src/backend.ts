import { signSessionClaims, verifySessionClaims } from "@voyant-travel/utils/session-claims"

export type VerifyTokenOptions = {
  secretKey: string
  clockSkewInMs?: number
}

export async function verifyToken(
  token: string,
  options: VerifyTokenOptions,
): Promise<{
  sub: string
  sid?: string
}> {
  const claims = await verifySessionClaims(token, options.secretKey)
  if (!claims) {
    throw new Error("Invalid or expired token")
  }

  return {
    sub: claims.userId,
    sid: claims.sessionId,
  }
}

export async function createApiTokenFromUserId(userId: string, secret: string): Promise<string> {
  return signSessionClaims(userId, `session:${userId}`, secret)
}
