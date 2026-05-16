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

export type AuthMode = "local" | "voyant-cloud"
export type BootstrapStatus = { hasUsers: boolean; authMode?: AuthMode }

export function cloudAuthStartHref(next?: string): string {
  const params = new URLSearchParams()
  if (next) {
    params.set("next", next)
  }

  const query = params.toString()
  return `/api/auth/cloud/start${query ? `?${query}` : ""}`
}

const withRequest = createMiddleware({ type: "request" }).server(({ next, request }) => {
  return next({ context: { request } })
})

export const getBootstrapStatus = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
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
