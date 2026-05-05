import { createMiddleware, createServerFn } from "@tanstack/react-start"

export type WorkspaceOrganization = {
  id: string
  name: string
  slug: string
  logo?: string | null
}

export type CurrentWorkspace = {
  organizations: WorkspaceOrganization[]
  activeOrganization: WorkspaceOrganization | null
}

const withRequest = createMiddleware({ type: "request" }).server(({ next, request }) => {
  return next({ context: { request } })
})

export const getCurrentWorkspace = createServerFn({ method: "GET" })
  .middleware([withRequest])
  .handler(async ({ context }) => {
    const headers = new Headers()
    const cookie = context.request.headers.get("cookie")

    if (cookie) {
      headers.set("cookie", cookie)
    }

    const response = await fetch(new URL("/api/auth/workspace", context.request.url), {
      headers,
      method: "GET",
    })

    if (response.status === 401 || response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error("Failed to fetch workspace")
    }

    return (await response.json()) as CurrentWorkspace
  })
