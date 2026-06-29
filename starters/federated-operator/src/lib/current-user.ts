import { createMiddleware, createServerFn } from "@tanstack/react-start"

export type { CurrentUser } from "./current-user-model"

import type { BootstrapStatus, CurrentUser } from "./current-user-model"
import { getFederatedOperatorStartEnv } from "./operator-start-context"

const withRequest = createMiddleware({ type: "request" }).server(({ context, next, request }) => {
  return next({
    context: { request, env: getFederatedOperatorStartEnv(context) },
  })
})

export const getBootstrapStatus = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (context.env) {
      const { getBootstrapStatusForRequest } = await import("../api/auth/handler")
      return getBootstrapStatusForRequest(context.request, context.env)
    }

    const response = await fetch(new URL("/api/auth/bootstrap-status", context.request.url), {
      method: "GET",
    })
    if (!response.ok) throw new Error("Failed to fetch bootstrap status")
    return (await response.json()) as BootstrapStatus
  })

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (context.env) {
      const { getCurrentUserForRequest } = await import("../api/auth/handler")
      return getCurrentUserForRequest(context.request, context.env)
    }

    const headers = new Headers()
    const cookie = context.request.headers.get("cookie")
    if (cookie) headers.set("cookie", cookie)

    const response = await fetch(new URL("/api/auth/me", context.request.url), {
      headers,
      method: "GET",
    })

    if (response.status === 401) {
      return null
    }

    if (!response.ok) {
      throw new Error("Failed to fetch current user")
    }

    return (await response.json()) as CurrentUser
  })

export function getCurrentUserQueryOptions(initialUser?: CurrentUser | null) {
  return {
    queryKey: ["current-user"] as const,
    queryFn: () => getCurrentUser(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    ...(initialUser !== undefined ? { initialData: initialUser } : {}),
  }
}
