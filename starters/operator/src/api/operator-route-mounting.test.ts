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
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import { mountApp } from "@voyant-travel/hono"
import { describe, expect, it } from "vitest"

import { createGeneratedGraphRuntime } from "../../.voyant/runtime/graph-runtime.generated"
import {
  buildOperatorProviders,
  buildOperatorRuntimePorts,
  operatorGraphRuntimeBindings,
} from "./composition"
import { OPERATOR_PUBLIC_PATHS } from "./public-paths"

const TEST_ENV = { DATABASE_URL: "postgres://test" } as never
const TEST_CTX = { waitUntil: () => {}, passThroughOnException: () => {} } as never

async function build() {
  const { modules, extensions } = await buildGraphComposition()
  return mountApp({
    // Stub db — enough to be leased + bridged; handlers may 5xx using it, which
    // still proves the route is mounted and the context reached the sub-app.
    // biome-ignore lint/suspicious/noExplicitAny: stub db for mount smoke test -- owner: operator API tests.
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

async function buildWithSessionActor(actor: Actor) {
  const { modules, extensions } = await buildGraphComposition()
  return mountApp({
    // biome-ignore lint/suspicious/noExplicitAny: stub db for auth-surface regression -- owner: operator API tests.
    db: () => ({}) as any,
    modules,
    extensions,
    auth: {
      resolve: () => ({ userId: "u1", actor }),
    },
  })
}

async function buildWithLiveFrontDoor(actor: Actor = "staff") {
  const { modules, extensions } = await buildGraphComposition()
  return mountApp({
    modules,
    extensions,
    publicPaths: [...OPERATOR_PUBLIC_PATHS],
    // biome-ignore lint/suspicious/noExplicitAny: stub db for mount smoke test -- owner: operator API tests.
    db: () => ({}) as any,
    auth: {
      resolve: () => ({ userId: "u1", actor }),
    },
  })
}

async function status(path: string, method = "GET"): Promise<number> {
  const app = await build()
  const res = await app.request(path, { method }, TEST_ENV, TEST_CTX)
  return res.status
}

async function liveFrontDoorStatus(path: string, init: RequestInit = {}): Promise<number> {
  const app = await buildWithLiveFrontDoor()
  const res = await app.request(path, init, TEST_ENV, TEST_CTX)
  return res.status
}

async function responseWithSessionActor(
  actor: Actor,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const app = await buildWithSessionActor(actor)
  return app.request(path, init, TEST_ENV, TEST_CTX)
}

function buildGraphComposition() {
  return composeVoyantGraphRuntime({
    runtime: createGeneratedGraphRuntime(),
    capabilities: buildOperatorProviders(),
    bindings: operatorGraphRuntimeBindings,
    ports: buildOperatorRuntimePorts(),
  })
}

describe("operator composed route mounting (smoke)", () => {
  it("returns 404 for an unmounted admin path (control)", async () => {
    expect(await status("/v1/admin/definitely-not-mounted/x")).toBe(404)
  })

  it("mounts MICE booking details routes through the live starter front door", async () => {
    const bookingPath = "/v1/admin/bookings/book_123/mice-details"

    expect(await liveFrontDoorStatus(bookingPath)).not.toBe(404)
    expect(
      await liveFrontDoorStatus(bookingPath, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId: "mice_program_123", delegateId: "mice_delegate_123" }),
      }),
    ).not.toBe(404)
    expect(await liveFrontDoorStatus(bookingPath, { method: "DELETE" })).not.toBe(404)
  })

  it("mounts lazyAdminRoutes modules (flights, mcp)", async () => {
    expect(await status("/v1/admin/flights/reference/airports")).not.toBe(404)
    // MCP is now a real MCP server: JSON-RPC at the mount root + a discovery manifest.
    expect(await status("/v1/admin/mcp", "POST")).not.toBe(404)
    expect(await status("/v1/admin/mcp/manifest")).not.toBe(404)
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

  it("mounts charters lazy admin + public surfaces (operator-local, voyant#2191)", async () => {
    // The public charter browse list is served (local-only when no adapter is
    // registered) — proves the operator actually mounts charters at runtime, not
    // just that it surfaces in the spec.
    expect(await status("/v1/public/charters")).not.toBe(404)
    expect(await status("/v1/admin/charters/products")).not.toBe(404)
  })

  it("mounts multi-prefix lazyRoutes families (catalog-booking, media, settings, payment-link)", async () => {
    expect(await status("/v1/admin/catalog/orders")).not.toBe(404)
    expect(await status("/v1/admin/media/anything")).not.toBe(404)
    expect(await liveFrontDoorStatus("/v1/admin/finance/tax-settings")).not.toBe(404)
    expect(await status("/v1/public/operator-profile")).not.toBe(404)
    expect(await status("/v1/public/settings/operator")).not.toBe(404)
    expect(await status("/v1/public/payment-link-config")).not.toBe(404)
  })

  it("mounts distribution channel-push admin routes used by channel sync", async () => {
    expect(await status("/v1/admin/distribution/links?limit=100")).not.toBe(404)
    expect(await status("/v1/admin/distribution/throttling")).not.toBe(404)
    expect(await status("/v1/admin/distribution/retry/booking_123", "POST")).not.toBe(404)
    expect(await status("/v1/admin/distribution/reconcile/bookings", "POST")).not.toBe(404)
  })

  it("lets storefront voucher validation pass the public actor gate even with an admin session", async () => {
    const res = await responseWithSessionActor("staff", "/v1/public/finance/vouchers/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "TEST-VOUCHER" }),
    })

    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(404)
  })

  it("mounts storefront offer routes selected by the deployment graph", async () => {
    const offerPayload = {
      productId: "prod_123",
      pax: 2,
      basePriceCents: 100_00,
      currency: "EUR",
    }

    const app = await buildWithLiveFrontDoor("customer")
    const detail = await app.request("/v1/public/offers/summer-sale", {}, TEST_ENV, TEST_CTX)
    const apply = await app.request(
      "/v1/public/offers/summer-sale/apply",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(offerPayload),
      },
      TEST_ENV,
      TEST_CTX,
    )
    const redeem = await app.request(
      "/v1/public/offers/redeem",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...offerPayload, code: "SAVE10" }),
      },
      TEST_ENV,
      TEST_CTX,
    )

    expect(detail.status).toBe(404)
    expect(apply.status).toBe(501)
    expect(redeem.status).toBe(501)
  })

  it("lets public operator settings pass the starter public actor gate", async () => {
    const settings = await liveFrontDoorStatus("/v1/public/settings/operator")

    expect(settings).not.toBe(401)
    expect(settings).not.toBe(403)
    expect(settings).not.toBe(404)
  })
})
