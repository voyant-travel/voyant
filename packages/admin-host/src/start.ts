import { createMiddleware, createStart } from "@tanstack/react-start"

const csrfMiddleware = createMiddleware({ type: "request" }).server(
  ({ request, serverFnMeta, next }) => {
    if (!serverFnMeta) return next()
    const method = request.method.toUpperCase()
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next()
    const origin = request.headers.get("origin")
    if (!origin) return next()
    try {
      if (new URL(origin).origin === new URL(request.url).origin) return next()
    } catch {
      // Invalid Origin values fail closed.
    }
    return new Response("Forbidden", { status: 403 })
  },
)

export const standardOperatorStart = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [csrfMiddleware],
}))
