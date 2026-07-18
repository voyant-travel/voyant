import { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import { appOAuthTokenSchema } from "./contracts.js"
import { createAppSessionTokenService } from "./session-token-service.js"

function trackedDatabaseStub(installationOverrides: Record<string, unknown> = {}) {
  const installation = {
    id: "inst_1",
    appId: "app_1",
    releaseId: "rel_1",
    deploymentId: "dep_1",
    status: "active",
    namespace: "app--one",
    ...installationOverrides,
  }
  const consume = vi.fn().mockResolvedValue([{ id: "session_1" }])
  const db = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [installation] }) }),
    }),
    insert: () => ({ values: async () => undefined }),
    update: () => ({
      set: () => ({ where: () => ({ returning: consume }) }),
    }),
    transaction: async (callback: (tx: PostgresJsDatabase) => Promise<unknown>) => callback(db),
  } as never as PostgresJsDatabase
  return { db, consume }
}

function databaseStub(): PostgresJsDatabase {
  return trackedDatabaseStub().db
}

describe("app session token service", () => {
  it("does not expose an app-asserted viewer scope grant on the public OAuth schema", () => {
    expect(
      appOAuthTokenSchema.safeParse({
        grant_type: "urn:voyant:params:oauth:grant-type:actor-token-exchange",
        installation_id: "inst_1",
        viewer_id: "viewer_1",
        viewer_scopes: ["finance-document-artifacts:write"],
        client_id: "app_1",
      }).success,
    ).toBe(false)
  })

  it("intersects app-requested scopes with host-signed viewer authority", async () => {
    const token = vi.fn().mockResolvedValue({ accessToken: "online" })
    const service = createAppSessionTokenService({
      secret: "test-deployment-session-secret-value-000000000000",
      deploymentId: "dep_1",
      oauth: { token } as never,
      now: () => new Date("2026-07-18T09:00:00.000Z"),
    })
    const db = databaseStub()
    const issued = await service.issue(db, {
      installationId: "inst_1",
      viewerId: "viewer_1",
      viewerScopes: ["finance-documents:read", "finance-document-artifacts:write"],
      entity: { type: "invoice", id: "invoice_1" },
      slot: "invoice.details.after-summary",
    })

    await service.exchange(db, {
      token: issued.token,
      clientId: "app_1",
      clientSecret: "secret",
      viewerScopes: [
        "finance-documents:read",
        "finance-document-artifacts:write",
        "finance-external-sync:write",
      ],
    })

    expect(token).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        viewerId: "viewer_1",
        viewerScopes: ["finance-document-artifacts:write", "finance-documents:read"],
        contextConstraint: {
          entity: { type: "invoice", id: "invoice_1" },
          slot: "invoice.details.after-summary",
        },
      }),
    )
  })

  it("fails closed to no online scopes when issuance had no viewer authority", async () => {
    const token = vi.fn().mockResolvedValue({ accessToken: "online" })
    const service = createAppSessionTokenService({
      secret: "test-deployment-session-secret-value-000000000000",
      deploymentId: "dep_1",
      oauth: { token } as never,
      now: () => new Date("2026-07-18T09:00:00.000Z"),
    })
    const db = databaseStub()
    const issued = await service.issue(db, {
      installationId: "inst_1",
      viewerId: "viewer_1",
    })

    await service.exchange(db, {
      token: issued.token,
      clientId: "app_1",
      viewerScopes: ["finance-document-artifacts:write"],
    })

    expect(token).toHaveBeenCalledWith(db, expect.objectContaining({ viewerScopes: [] }))
  })

  it("does not consume the JTI when app client authentication fails", async () => {
    const token = vi.fn(async (_db, input: { clientSecret?: string }) => {
      if (input.clientSecret !== "right-secret") {
        throw new ApiHttpError("Client authentication failed", {
          status: 401,
          code: "invalid_client",
        })
      }
      return { accessToken: "online" }
    })
    const service = createAppSessionTokenService({
      secret: "test-deployment-session-secret-value-000000000000",
      deploymentId: "dep_1",
      oauth: { token } as never,
      now: () => new Date("2026-07-18T09:00:00.000Z"),
    })
    const { db, consume } = trackedDatabaseStub()
    const issued = await service.issue(db, {
      installationId: "inst_1",
      viewerId: "viewer_1",
    })

    await expect(
      service.exchange(db, {
        token: issued.token,
        clientId: "app_1",
        clientSecret: "wrong-secret",
        viewerScopes: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_client" })
    expect(consume).not.toHaveBeenCalled()

    await expect(
      service.exchange(db, {
        token: issued.token,
        clientId: "app_1",
        clientSecret: "right-secret",
        viewerScopes: [],
      }),
    ).resolves.toEqual({ accessToken: "online" })
    expect(consume).toHaveBeenCalledOnce()
  })

  it("leaves the JTI retryable when online credential minting fails", async () => {
    const token = vi
      .fn()
      .mockRejectedValueOnce(new Error("credential insert failed"))
      .mockResolvedValueOnce({ accessToken: "online" })
    const service = createAppSessionTokenService({
      secret: "test-deployment-session-secret-value-000000000000",
      deploymentId: "dep_1",
      oauth: { token } as never,
      now: () => new Date("2026-07-18T09:00:00.000Z"),
    })
    const { db, consume } = trackedDatabaseStub()
    const issued = await service.issue(db, {
      installationId: "inst_1",
      viewerId: "viewer_1",
    })
    const input = {
      token: issued.token,
      clientId: "app_1",
      viewerScopes: [] as string[],
    }

    await expect(service.exchange(db, input)).rejects.toThrow("credential insert failed")
    expect(consume).not.toHaveBeenCalled()
    await expect(service.exchange(db, input)).resolves.toEqual({ accessToken: "online" })
    expect(consume).toHaveBeenCalledOnce()
  })

  it("keeps a managed session exchange valid across deployment rollouts", async () => {
    const token = vi.fn().mockResolvedValue({ accessToken: "online" })
    const installationAuthority = {
      workloadEnvironmentId: "workload_environment_1",
      resolveInstallationContract: async () => ({ contractGeneration: 7 }),
    }
    const { db } = trackedDatabaseStub({
      workloadEnvironmentId: "workload_environment_1",
      contractGeneration: 7,
    })
    const issued = await createAppSessionTokenService({
      secret: "test-deployment-session-secret-value-000000000000",
      deploymentId: "deployment_revision_1",
      managedInstallation: installationAuthority,
      oauth: { token } as never,
      now: () => new Date("2026-07-18T09:00:00.000Z"),
    }).issue(db, { installationId: "inst_1", viewerId: "viewer_1" })

    await expect(
      createAppSessionTokenService({
        secret: "test-deployment-session-secret-value-000000000000",
        deploymentId: "deployment_revision_2",
        managedInstallation: installationAuthority,
        oauth: { token } as never,
        now: () => new Date("2026-07-18T09:00:01.000Z"),
      }).exchange(db, {
        token: issued.token,
        clientId: "app_1",
        viewerScopes: [],
      }),
    ).resolves.toEqual({ accessToken: "online" })
  })
})
