import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import {
  createAppOAuthService,
  intersectAppTokenScopes,
  readStoredAppContextConstraint,
  readStoredScopes,
} from "./oauth-service.js"
import { appCredentials, appReleases } from "./schema.js"

describe("app OAuth online token scope intersection", () => {
  it("never exceeds either app grants, viewer grants, or contextual restrictions", () => {
    expect(
      intersectAppTokenScopes(
        ["bookings:read", "invoices:read"],
        ["bookings:read", "customers:read"],
        ["bookings:read", "invoices:read"],
      ),
    ).toEqual(["bookings:read"])

    expect(
      intersectAppTokenScopes(
        ["bookings:read"],
        ["bookings:read", "invoices:read"],
        ["bookings:read", "invoices:read"],
      ),
    ).toEqual(["bookings:read"])
  })
})

describe("stored online token scopes", () => {
  it("round-trips the minted scope set and ignores malformed metadata", () => {
    expect(readStoredScopes({ scopeCount: 1, scopes: ["bookings:read"] })).toEqual([
      "bookings:read",
    ])
    expect(readStoredScopes({ scopes: ["bookings:read", 7, null] })).toEqual(["bookings:read"])
    expect(readStoredScopes({ scopeCount: 2 })).toBeNull()
    expect(readStoredScopes({ scopes: "bookings:read" })).toBeNull()
  })

  it("fails closed unless immutable extension context metadata is complete", () => {
    expect(
      readStoredAppContextConstraint({
        contextConstraint: {
          entity: { type: "invoice", id: "invoice_1" },
          slot: "invoice.details.after-summary",
        },
      }),
    ).toEqual({
      entity: { type: "invoice", id: "invoice_1" },
      slot: "invoice.details.after-summary",
    })
    expect(readStoredAppContextConstraint({})).toBeNull()
    expect(
      readStoredAppContextConstraint({ contextConstraint: { entity: { type: "invoice" } } }),
    ).toBeNull()
    expect(
      readStoredAppContextConstraint({
        contextConstraint: { entity: { type: "invoice", id: "invoice_1" }, slot: "" },
      }),
    ).toBeNull()
  })
})

describe("authorization release lifecycle", () => {
  function dbWithRelease(state: string): PostgresJsDatabase {
    const release = {
      id: "apprel_1",
      appId: "app_1",
      state,
      releaseVersion: "1.0.0",
    }
    const db = Object.create(null) as PostgresJsDatabase
    Object.assign(db, {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => (table === appReleases ? [release] : []),
          }),
        }),
      }),
    })
    return db
  }

  const authorizeInput = {
    appId: "app_1",
    releaseId: "apprel_1",
    redirectUri: "https://app.example.com/callback",
    state: "state-1",
    codeChallenge: "c".repeat(43),
    codeChallengeMethod: "S256" as const,
    actorId: "user_1",
    operatorGrantedScopes: [],
    grantedOptionalScopes: [],
  }

  it.each(["suspended", "yanked"])("rejects a %s release before any side effect", async (state) => {
    const service = createAppOAuthService({
      accessCatalog: { resources: [], presets: [] },
      deploymentId: "dep_1",
    })
    await expect(service.authorize(dbWithRelease(state), authorizeInput)).rejects.toMatchObject({
      status: 409,
    })
  })
})

describe("managed client authentication", () => {
  it("fails closed when confidential-client provisioning is absent", async () => {
    const db = Object.assign(Object.create(null), {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({ limit: async () => (table === appCredentials ? [] : []) }),
        }),
      }),
    }) as PostgresJsDatabase
    const service = createAppOAuthService({
      accessCatalog: { resources: [], presets: [] },
      deploymentId: "dep_1",
      clientAuthentication: "required",
    })

    await expect(
      service.token(db, {
        grantType: "refresh_token",
        refreshToken: "app_refresh_fixture",
        clientId: "app_1",
      }),
    ).rejects.toMatchObject({ status: 401, code: "invalid_client" })
  })
})
