import { createContainer } from "@voyant-travel/core"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { writeIntents, bootstrapBookingSession } = vi.hoisted(() => ({
  writeIntents: {
    enqueueWriteIntent: vi.fn(),
    getWriteIntent: vi.fn(),
    settleWriteIntent: vi.fn(async () => true),
  },
  bootstrapBookingSession: vi.fn(),
}))
vi.mock("@voyant-travel/db/write-intents", () => writeIntents)
vi.mock("../../src/service.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/service.js")>()
  return {
    ...original,
    createStorefrontService: (options?: unknown) => ({
      ...original.createStorefrontService(options as never),
      bootstrapBookingSession,
    }),
  }
})

import {
  registerStorefrontBookingBootstrapRuntime,
  storefrontBookingBootstrapSubscriber,
} from "../../src/booking-bootstrap-subscriber-runtime.js"
// Import after mocks.
import {
  BOOKING_BOOTSTRAP_INTENT_EVENT,
  BOOKING_BOOTSTRAP_INTENT_KIND,
  createBookingBootstrapIntentHandler,
} from "../../src/booking-intents.js"
import { createStorefrontPublicRoutes } from "../../src/routes-public.js"

const VALID_INPUT = {
  departureId: "avsl_1",
  slotId: "avsl_1",
  quote: { currencyCode: "EUR", totalSellAmountCents: 10_000 },
  session: {
    sellCurrency: "EUR",
    items: [{ title: "Tour", availabilitySlotId: "avsl_1" }],
  },
}
const CHECKOUT_CAPABILITY_TEST_SECRET = "x".repeat(40)

function pendingIntent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "wint_1",
    kind: BOOKING_BOOTSTRAP_INTENT_KIND,
    payload: { input: VALID_INPUT, userId: undefined },
    idempotencyKey: "idem-1",
    status: "pending",
    result: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  writeIntents.settleWriteIntent.mockResolvedValue(true)
})

describe("createBookingBootstrapIntentHandler", () => {
  const deps = { resolveDb: () => ({}) as never }
  const envelope = (intentId: string) => ({
    name: BOOKING_BOOTSTRAP_INTENT_EVENT,
    data: { intentId },
    emittedAt: new Date().toISOString(),
  })

  it("runs the bootstrap and settles succeeded with the bootstrap payload", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent())
    bootstrapBookingSession.mockResolvedValue({
      status: "ok",
      bootstrap: { session: { sessionId: "bs_1" } },
    })

    await createBookingBootstrapIntentHandler(deps)(envelope("wint_1"))

    expect(writeIntents.settleWriteIntent).toHaveBeenCalledWith({}, "wint_1", {
      status: "succeeded",
      result: { bootstrap: { session: { sessionId: "bs_1" } } },
    })
  })

  it("settles business conflicts as failed WITHOUT retrying", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent())
    bootstrapBookingSession.mockResolvedValue({ status: "insufficient_capacity" })

    await expect(
      createBookingBootstrapIntentHandler(deps)(envelope("wint_1")),
    ).resolves.toBeUndefined()

    expect(writeIntents.settleWriteIntent).toHaveBeenCalledWith({}, "wint_1", {
      status: "failed",
      error: "insufficient_capacity",
      result: { conflict: "insufficient_capacity", httpStatus: 409 },
    })
  })

  it("rethrows infra errors so the outbox retries (intent stays pending)", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent())
    bootstrapBookingSession.mockRejectedValue(new Error("db unreachable"))

    await expect(createBookingBootstrapIntentHandler(deps)(envelope("wint_1"))).rejects.toThrow(
      "db unreachable",
    )
    expect(writeIntents.settleWriteIntent).not.toHaveBeenCalled()
  })

  it("skips settled or foreign intents (at-least-once redelivery safety)", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent({ status: "succeeded" }))
    await createBookingBootstrapIntentHandler(deps)(envelope("wint_1"))

    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent({ kind: "other.kind" }))
    await createBookingBootstrapIntentHandler(deps)(envelope("wint_1"))

    expect(bootstrapBookingSession).not.toHaveBeenCalled()
    expect(writeIntents.settleWriteIntent).not.toHaveBeenCalled()
  })
})

describe("storefrontBookingBootstrapSubscriber", () => {
  it("registers once and executes through the deployment-owned database lifecycle", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent())
    bootstrapBookingSession.mockResolvedValue({
      status: "ok",
      bootstrap: { session: { sessionId: "bs_1" } },
    })
    const container = createContainer()
    const withDb = vi.fn(async (_bindings, operation) => operation({} as never))
    registerStorefrontBookingBootstrapRuntime(container, { withDb })
    const subscribe = vi.fn()
    const eventBus = { subscribe } as never

    storefrontBookingBootstrapSubscriber.register({
      bindings: { deployment: "node" },
      container,
      eventBus,
    })

    expect(subscribe).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledWith(BOOKING_BOOTSTRAP_INTENT_EVENT, expect.any(Function))
    const handler = subscribe.mock.calls[0]?.[1]
    await handler?.({
      name: BOOKING_BOOTSTRAP_INTENT_EVENT,
      data: { intentId: "wint_1" },
      emittedAt: new Date().toISOString(),
    })

    expect(withDb).toHaveBeenCalledOnce()
    expect(withDb).toHaveBeenCalledWith({ deployment: "node" }, expect.any(Function))
    expect(writeIntents.settleWriteIntent).toHaveBeenCalledWith({}, "wint_1", {
      status: "succeeded",
      result: { bootstrap: { session: { sessionId: "bs_1" } } },
    })
  })

  it("rethrows infrastructure failures from the executable descriptor", async () => {
    writeIntents.getWriteIntent.mockRejectedValue(new Error("database unavailable"))
    const container = createContainer()
    registerStorefrontBookingBootstrapRuntime(container, {
      withDb: async (_bindings, operation) => operation({} as never),
    })
    const subscribe = vi.fn()
    storefrontBookingBootstrapSubscriber.register({
      bindings: {},
      container,
      eventBus: { subscribe } as never,
    })
    const handler = subscribe.mock.calls[0]?.[1]

    await expect(
      handler?.({
        name: BOOKING_BOOTSTRAP_INTENT_EVENT,
        data: { intentId: "wint_1" },
        emittedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("database unavailable")
    expect(writeIntents.settleWriteIntent).not.toHaveBeenCalled()
  })
})

describe("async bootstrap route mode", () => {
  function idempotencyDbStub() {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }
  }

  function buildApp(options?: { withBookingIntents?: boolean; withActiveSubscriber?: boolean }) {
    const emit = vi.fn(async () => {})
    const container = createContainer()
    const eventBus = { emit, subscribe: vi.fn() }
    if (options?.withActiveSubscriber !== false) {
      storefrontBookingBootstrapSubscriber.register({ bindings: {}, container, eventBus } as never)
    }
    const routes = createStorefrontPublicRoutes(
      options?.withBookingIntents === false
        ? undefined
        : {
            bookingIntents: {
              withDb: async (_bindings, operation) => operation({} as never),
            },
          },
    )
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, idempotencyDbStub() as never)
      c.set("container" as never, container)
      c.set("eventBus" as never, eventBus as never)
      await next()
    })
    app.route("/", routes)
    return { app, emit }
  }

  const ENV = { VOYANT_CHECKOUT_CAPABILITY_SECRET: CHECKOUT_CAPABILITY_TEST_SECRET }

  it("?async=1 enqueues an intent, emits its event, and returns 202 + status URL", async () => {
    writeIntents.enqueueWriteIntent.mockResolvedValue({
      intent: pendingIntent(),
      created: true,
    })
    const { app, emit } = buildApp()

    const res = await app.request(
      "/bookings/sessions/bootstrap?async=1",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "bootstrap-test-1" },
        body: JSON.stringify(VALID_INPUT),
      },
      ENV,
    )

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({
      data: {
        intentId: "wint_1",
        status: "pending",
        statusUrl: "/v1/public/bookings/intents/wint_1",
      },
    })
    // The stored input is the PARSED body (zod defaults applied), so the
    // handler re-validates against an already-normalized payload.
    expect(writeIntents.enqueueWriteIntent).toHaveBeenCalledWith(expect.any(Object), {
      kind: BOOKING_BOOTSTRAP_INTENT_KIND,
      payload: {
        input: {
          ...VALID_INPUT,
          session: {
            ...VALID_INPUT.session,
            items: [
              {
                ...VALID_INPUT.session.items[0],
                itemType: "unit",
                quantity: 1,
                allocationType: "unit",
              },
            ],
          },
        },
        userId: undefined,
      },
      idempotencyKey: "bootstrap-test-1",
    })
    expect(emit).toHaveBeenCalledWith(BOOKING_BOOTSTRAP_INTENT_EVENT, { intentId: "wint_1" })
  })

  it("a duplicate enqueue does NOT re-emit the event", async () => {
    writeIntents.enqueueWriteIntent.mockResolvedValue({
      intent: pendingIntent(),
      created: false,
    })
    const { app, emit } = buildApp()

    const res = await app.request(
      "/bookings/sessions/bootstrap?async=1",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "bootstrap-test-1" },
        body: JSON.stringify(VALID_INPUT),
      },
      ENV,
    )

    expect(res.status).toBe(202)
    expect(emit).not.toHaveBeenCalled()
  })

  it("falls back to the SYNC path when bookingIntents is not wired (no orphaned 202s)", async () => {
    bootstrapBookingSession.mockResolvedValue({
      status: "ok",
      bootstrap: { session: { sessionId: "bs_sync" } },
    })
    const { app, emit } = buildApp({ withBookingIntents: false })

    const res = await app.request(
      "/bookings/sessions/bootstrap?async=1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(VALID_INPUT),
      },
      { VOYANT_CHECKOUT_CAPABILITY_SECRET: CHECKOUT_CAPABILITY_TEST_SECRET },
    )

    // Synchronous 201 with the real session — never an unprocessable 202.
    expect(res.status).toBe(201)
    expect(bootstrapBookingSession).toHaveBeenCalledOnce()
    expect(writeIntents.enqueueWriteIntent).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("falls back to sync when database wiring exists without the graph subscriber", async () => {
    bootstrapBookingSession.mockResolvedValue({
      status: "ok",
      bootstrap: { session: { sessionId: "bs_direct" } },
    })
    const { app, emit } = buildApp({ withActiveSubscriber: false })

    const res = await app.request(
      "/bookings/sessions/bootstrap?async=1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(VALID_INPUT),
      },
      ENV,
    )

    expect(res.status).toBe(201)
    expect(writeIntents.enqueueWriteIntent).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})

describe("GET /bookings/intents/:id", () => {
  function buildApp() {
    const routes = createStorefrontPublicRoutes()
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, {} as never)
      await next()
    })
    app.route("/", routes)
    return app
  }

  const ENV = { VOYANT_CHECKOUT_CAPABILITY_SECRET: CHECKOUT_CAPABILITY_TEST_SECRET }

  it("returns pending status", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent())
    const res = await buildApp().request("/bookings/intents/wint_1", {}, ENV)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { intentId: "wint_1", status: "pending" } })
  })

  it("returns the bootstrap payload + a freshly issued checkout capability on success", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(
      pendingIntent({
        status: "succeeded",
        result: { bootstrap: { session: { sessionId: "bs_9" }, quote: { ok: true } } },
      }),
    )
    const res = await buildApp().request("/bookings/intents/wint_1", {}, ENV)

    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie")).toBeTruthy()
    const body = (await res.json()) as {
      data: { status: string; session: { sessionId: string; checkoutCapability?: unknown } }
    }
    expect(body.data.status).toBe("succeeded")
    expect(body.data.session.sessionId).toBe("bs_9")
    expect(body.data.session.checkoutCapability).toBeDefined()
  })

  it("returns conflict details for failed intents", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(
      pendingIntent({
        status: "failed",
        error: "insufficient_capacity",
        result: { conflict: "insufficient_capacity", httpStatus: 409 },
      }),
    )
    const res = await buildApp().request("/bookings/intents/wint_1", {}, ENV)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: {
        intentId: "wint_1",
        status: "failed",
        error: "Insufficient slot capacity",
        // Machine-readable contract mirrored from the sync route (issue voyant#1984).
        code: "INSUFFICIENT_CAPACITY",
        retryable: false,
        conflict: "insufficient_capacity",
        httpStatus: 409,
      },
    })
  })

  it("404s unknown or foreign-kind intents", async () => {
    writeIntents.getWriteIntent.mockResolvedValue(null)
    const missing = await buildApp().request("/bookings/intents/wint_x", {}, ENV)
    expect(missing.status).toBe(404)

    writeIntents.getWriteIntent.mockResolvedValue(pendingIntent({ kind: "other" }))
    const foreign = await buildApp().request("/bookings/intents/wint_1", {}, ENV)
    expect(foreign.status).toBe(404)
  })
})
