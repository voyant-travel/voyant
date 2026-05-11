import { createMiddleware, createServerFn } from "@tanstack/react-start"

export type CurrentUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  locale: string
  timezone: string | null
  // biome-ignore lint/complexity/noBannedTypes: UI prefs are opaque JSON blobs passed through app/server boundaries.
  uiPrefs: Record<string, {}> | null
  isSuperAdmin: boolean
  isSupportUser: boolean
  createdAt: string
  profilePictureUrl?: string | null
}

export type BootstrapStatus = { hasUsers: boolean }

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname
  return hostname === "127.0.0.1" || hostname === "localhost"
}

function useBrowserEvidenceAuthFallback(request: Request): boolean {
  return process.env.VOYANT_OPERATOR_BROWSER_EVIDENCE === "1" && isLocalRequest(request)
}

const withRequest = createMiddleware({ type: "request" }).server(({ next, request }) => {
  return next({ context: { request } })
})

export const getBootstrapStatus = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (useBrowserEvidenceAuthFallback(context.request)) {
      return { hasUsers: true }
    }

    const response = await fetch(new URL("/api/auth/bootstrap-status", context.request.url), {
      method: "GET",
    })
    if (!response.ok) {
      throw new Error("Failed to fetch bootstrap status")
    }
    return (await response.json()) as BootstrapStatus
  })

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    if (useBrowserEvidenceAuthFallback(context.request)) {
      return null
    }

    const headers = new Headers()
    const cookie = context.request.headers.get("cookie")

    if (cookie) {
      headers.set("cookie", cookie)
    }

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
