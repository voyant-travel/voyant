import type { Context, Hono as HonoType } from "hono"
import { Hono } from "hono"

// biome-ignore lint/suspicious/noExplicitAny: lazy sub-apps keep route-specific Hono env generics.
type AnyHono = HonoType<any>
type RouteMount = (hono: AnyHono) => void

function lazyRouteApp(loadMount: () => Promise<RouteMount>) {
  let appPromise: Promise<AnyHono> | undefined

  return async (c: Context) => {
    appPromise ??= loadMount().then((mount) => {
      const app = new Hono()
      mount(app)
      return app
    })

    const app = await appPromise
    return app.fetch(c.req.raw, c.env, c.executionCtx)
  }
}

export function mountLazyRouteApp(
  hono: AnyHono,
  paths: readonly string[],
  loadMount: () => Promise<RouteMount>,
): void {
  const handler = lazyRouteApp(loadMount)
  for (const path of paths) {
    hono.all(path, handler)
  }
}
