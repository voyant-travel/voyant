import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { ApiModule } from "@voyant-travel/hono/module"
import type { Context } from "hono"

import {
  type BookingSessionActorKindV1,
  bookingSessionOutcomeV1,
  commitBookingSessionV1,
  createBookingSessionV1,
  placeBookingHoldV1,
  quoteBookingSessionV1,
  updateBookingSessionV1,
} from "./contracts.js"
import type { BookingSessionModule } from "./sessions-service.js"

type Env = {
  Variables: Record<string, unknown>
}

export interface BookingSessionRoutesOptions {
  resolveModule(c: Context): BookingSessionModule
  actorKind: BookingSessionActorKindV1
}

const sessionParamSchema = z.object({ sessionId: z.string().min(1) })
const errorResponseSchema = z.object({ error: z.string(), code: z.string().optional() })

const createSessionRoute = createRoute({
  method: "post",
  path: "/booking-sessions",
  request: {
    body: { required: true, content: { "application/json": { schema: createBookingSessionV1 } } },
  },
  responses: {
    200: {
      description: "Booking Session created",
      content: { "application/json": { schema: bookingSessionOutcomeV1 } },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateSessionRoute = createRoute({
  method: "patch",
  path: "/booking-sessions/{sessionId}",
  request: {
    params: sessionParamSchema,
    body: { required: true, content: { "application/json": { schema: updateBookingSessionV1 } } },
  },
  responses: {
    200: {
      description: "Booking Session updated",
      content: { "application/json": { schema: bookingSessionOutcomeV1 } },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const quoteSessionRoute = createRoute({
  method: "post",
  path: "/booking-sessions/{sessionId}/quote",
  request: {
    params: sessionParamSchema,
    body: { required: true, content: { "application/json": { schema: quoteBookingSessionV1 } } },
  },
  responses: {
    200: {
      description: "Exact-revision Quote created",
      content: { "application/json": { schema: bookingSessionOutcomeV1 } },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const holdSessionRoute = createRoute({
  method: "post",
  path: "/booking-sessions/{sessionId}/hold",
  request: {
    params: sessionParamSchema,
    body: { required: true, content: { "application/json": { schema: placeBookingHoldV1 } } },
  },
  responses: {
    200: {
      description: "Real-capacity Hold created",
      content: { "application/json": { schema: bookingSessionOutcomeV1 } },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const commitSessionRoute = createRoute({
  method: "post",
  path: "/booking-sessions/{sessionId}/commit",
  request: {
    params: sessionParamSchema,
    body: { required: true, content: { "application/json": { schema: commitBookingSessionV1 } } },
  },
  responses: {
    200: {
      description: "Admitted Commit outcome",
      content: { "application/json": { schema: bookingSessionOutcomeV1 } },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export function createBookingSessionRoutes(options: BookingSessionRoutesOptions): OpenAPIHono<Env> {
  return new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
    .openapi(createSessionRoute, async (c) =>
      asRouteResponse(
        c.json(
          await options.resolveModule(c).createSession({
            ...c.req.valid("json"),
            actorKind: options.actorKind,
          }),
        ),
      ),
    )
    .openapi(updateSessionRoute, async (c) =>
      asRouteResponse(
        c.json(
          await options
            .resolveModule(c)
            .updateSession(c.req.valid("param").sessionId, c.req.valid("json")),
        ),
      ),
    )
    .openapi(quoteSessionRoute, async (c) =>
      asRouteResponse(
        c.json(
          await options
            .resolveModule(c)
            .quoteSession(c.req.valid("param").sessionId, c.req.valid("json")),
        ),
      ),
    )
    .openapi(holdSessionRoute, async (c) =>
      asRouteResponse(
        c.json(
          await options
            .resolveModule(c)
            .placeHold(c.req.valid("param").sessionId, c.req.valid("json")),
        ),
      ),
    )
    .openapi(commitSessionRoute, async (c) =>
      asRouteResponse(
        c.json(
          await options
            .resolveModule(c)
            .commitSession(c.req.valid("param").sessionId, c.req.valid("json")),
        ),
      ),
    )
}

// biome-ignore lint/suspicious/noExplicitAny: bridges plain Hono responses to zod-openapi's inferred route union.
function asRouteResponse(response: Response): any {
  return response
}

export function createBookingSessionApiModule(options: {
  resolveModule(c: Context): BookingSessionModule
}): ApiModule {
  return {
    module: { name: "catalog" },
    adminRoutes: createBookingSessionRoutes({ ...options, actorKind: "staff" }),
    publicRoutes: createBookingSessionRoutes({ ...options, actorKind: "anonymous" }),
  }
}
