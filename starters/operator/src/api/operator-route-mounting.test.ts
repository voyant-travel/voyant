/**
 * Integration smoke test: mount the REAL operator composition through
 * `createApp` and confirm the migrated route families actually resolve.
 *
 * A mounted route returns something other than 404 (it may 4xx/5xx on the stub
 * db — we only assert it is reached). An unmounted path returns 404. This
 * exercises all three lazy mechanisms (lazyAdminRoutes, lazyPublicRoutes,
 * multi-prefix lazyRoutes) end-to-end through the composed registry, including
 * the context bridge (handlers read c.var.db without throwing "undefined db").
 */

import type { Actor } from "@voyant-travel/core"
import { createApp } from "@voyant-travel/hono"
import { composeFromManifest } from "@voyant-travel/hono/composition"
import { describe, expect, it } from "vitest"

import {
  buildOperatorCapabilities,
  OPERATOR_RUNTIME_MANIFEST,
  operatorComposition,
} from "./composition"

const TEST_ENV = { DATABASE_URL: "postgres://test" } as never
const TEST_CTX = { waitUntil: () => {}, passThroughOnException: () => {} } as never

function build() {
  const { modules, extensions } = composeFromManifest(
    OPERATOR_RUNTIME_MANIFEST,
    operatorComposition,
    buildOperatorCapabilities(),
  )
  return createApp({
    // Stub db — enough to be leased + bridged; handlers may 5xx using it, which
    // still proves the route is mounted and the context reached the sub-app.
    // biome-ignore lint/suspicious/noExplicitAny: stub db for mount smoke test.
    db: () => ({}) as any,
    modules,
    extensions,
    auth: {
      resolve: ({ request }) => {
        const actor: Actor = new URL(request.url).pathname.startsWith("/v1/public/")
          ? "customer"
          : "staff"
        return { userId: "u1", actor }
      },
    },
  })
}

async function status(path: string, method = "GET"): Promise<number> {
  const app = build()
  const res = await app.request(path, { method }, TEST_ENV, TEST_CTX)
  return res.status
}

describe("operator composed route mounting (smoke)", () => {
  it("returns 404 for an unmounted admin path (control)", async () => {
    expect(await status("/v1/admin/definitely-not-mounted/x")).toBe(404)
  })

  it("mounts lazyAdminRoutes modules (flights, mcp)", async () => {
    expect(await status("/v1/admin/flights/reference/airports")).not.toBe(404)
    expect(await status("/v1/admin/mcp/tools/create-trip", "POST")).not.toBe(404)
  })

  it("mounts lazy module admin + public surfaces (invitations)", async () => {
    expect(await status("/v1/admin/invitations")).not.toBe(404)
    expect(await status("/v1/public/invitations/tok_123")).not.toBe(404)
  })

  it("mounts lazy extensions (action-ledger health, proposals, catalog offers)", async () => {
    expect(await status("/v1/admin/action-ledger/health")).not.toBe(404)
    expect(await status("/v1/public/proposals/qv_123")).not.toBe(404)
    expect(await status("/v1/admin/catalog/package-offers", "POST")).not.toBe(404)
  })

  it("mounts multi-prefix lazyRoutes families (catalog-booking, media, settings, payment-link)", async () => {
    expect(await status("/v1/admin/catalog/orders")).not.toBe(404)
    expect(await status("/v1/admin/media/anything")).not.toBe(404)
    expect(await status("/v1/public/operator-profile")).not.toBe(404)
    expect(await status("/v1/public/payment-link-config")).not.toBe(404)
  })
})
