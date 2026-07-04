import { describe, expect, test } from "vitest"

import { SourceConnectionLifecycleError, sourceConnectionsService } from "../../src/service.js"
import { createMemorySourceConnectionsDb } from "./fixtures.js"

describe("sourceConnectionsService", () => {
  test("creates a draft connection with credential references and declared capabilities", async () => {
    const db = createMemorySourceConnectionsDb()

    const row = await sourceConnectionsService.createDraftConnection(db, {
      sourceKind: "crm:hubspot",
      displayName: "HubSpot production",
      capabilityScope: "people",
      sourceOfTruthMode: "mirrored",
      credentialRef: "secret://source-connections/hubspot-prod",
      credentialRefVersion: null,
      sourceAccountId: "portal-123",
      grantedScopes: ["crm.objects.contacts.read"],
      capabilities: [{ capability: "delta sync", state: "supported" }],
      rateLimitState: null,
      cursorState: null,
      metadata: null,
    })

    expect(row).toMatchObject({
      sourceKind: "crm:hubspot",
      displayName: "HubSpot production",
      status: "draft",
      healthStatus: "unknown",
      credentialRef: "secret://source-connections/hubspot-prod",
      grantedScopes: ["crm.objects.contacts.read"],
      capabilities: [{ capability: "delta sync", state: "supported" }],
    })
  })

  test("rejects secret-shaped keys in JSON summary fields", async () => {
    const db = createMemorySourceConnectionsDb()

    await expect(
      sourceConnectionsService.createDraftConnection(db, {
        sourceKind: "crm:hubspot",
        displayName: "HubSpot production",
        capabilityScope: "people",
        sourceOfTruthMode: "mirrored",
        credentialRef: "secret://source-connections/hubspot-prod",
        credentialRefVersion: null,
        sourceAccountId: null,
        grantedScopes: [],
        capabilities: [],
        rateLimitState: null,
        cursorState: null,
        metadata: { accessToken: "raw-token" },
      }),
    ).rejects.toMatchObject({
      code: "invalid_source_connection_transition",
      details: { path: "metadata.accessToken" },
    })
  })

  test("enforces lifecycle transitions", async () => {
    const db = createMemorySourceConnectionsDb()
    const draft = await sourceConnectionsService.createDraftConnection(db, {
      sourceKind: "crm:hubspot",
      displayName: "HubSpot production",
      capabilityScope: "people",
      sourceOfTruthMode: "mirrored",
      credentialRef: "secret://source-connections/hubspot-prod",
      credentialRefVersion: null,
      sourceAccountId: null,
      grantedScopes: [],
      capabilities: [],
      rateLimitState: null,
      cursorState: null,
      metadata: null,
    })

    const active = await sourceConnectionsService.resumeConnection(db, draft.id, {})
    expect(active?.status).toBe("active")

    const paused = await sourceConnectionsService.pauseConnection(db, draft.id, {
      reason: "waiting for adapter credentials",
    })
    expect(paused?.status).toBe("paused")
    expect(paused?.lastErrorMessage).toBe("waiting for adapter credentials")

    const disconnected = await sourceConnectionsService.markDisconnected(db, draft.id, {
      reason: "source removed",
      disconnectBehavior: ["stop future sync only"],
    })
    expect(disconnected).toMatchObject({
      status: "disconnected",
      disconnectReason: "source removed",
      disconnectBehavior: ["stop future sync only"],
    })
    expect(disconnected?.disconnectedAt).toBeInstanceOf(Date)

    await expect(
      sourceConnectionsService.resumeConnection(db, draft.id, {}),
    ).rejects.toBeInstanceOf(SourceConnectionLifecycleError)
  })
})
