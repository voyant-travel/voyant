import type { Context } from "hono"

import { UnauthorizedApiError } from "../validation.js"

export interface CustomerIdentityContext {
  userId: string
  sessionId: string | null
  email: string | null
  relationshipPersonId: string | null
}

/** Requires customer-realm identity without requiring a selected buyer account. */
export function requireCustomerIdentityContext(c: Context): CustomerIdentityContext {
  if (c.get("realm") !== "customer" || c.get("actor") !== "customer") {
    throw new UnauthorizedApiError()
  }
  const userId = c.get("userId")
  if (!userId) throw new UnauthorizedApiError()
  return {
    userId,
    sessionId: c.get("sessionId") ?? null,
    email: c.get("email") ?? null,
    relationshipPersonId: c.get("relationshipPersonId") ?? null,
  }
}
