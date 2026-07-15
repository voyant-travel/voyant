import { createToolRegistry } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"

import {
  createIdentityAddressTool,
  type IdentityToolContext,
  identityTools,
  listIdentityContactPointsTool,
  updateIdentityNamedContactTool,
} from "./tools.js"

const now = "2026-07-15T00:00:00.000Z"
const contactPoint = {
  id: "idcp_00000000000000000000000000",
  entityType: "organization",
  entityId: "org_1",
  kind: "email" as const,
  label: null,
  value: "ops@example.com",
  normalizedValue: "ops@example.com",
  isPrimary: true,
  notes: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
}

function context(): IdentityToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "tenant-1",
    resolverScope: {
      locale: "en",
      audience: "staff",
      market: "default",
      actor: "staff",
    },
    identity: {
      listContactPoints: vi.fn(async () => ({
        data: [{ ...contactPoint, createdAt: new Date(now), updatedAt: new Date(now) }],
        total: 1,
        limit: 50,
        offset: 0,
      })),
      getContactPointById: vi.fn(async () => contactPoint),
      createContactPoint: vi.fn(async () => contactPoint),
      updateContactPoint: vi.fn(async () => contactPoint),
      listAddresses: vi.fn(async () => ({ data: [], total: 0, limit: 50, offset: 0 })),
      getAddressById: vi.fn(async () => null),
      createAddress: vi.fn(async () => null),
      updateAddress: vi.fn(async () => null),
      listNamedContacts: vi.fn(async () => ({ data: [], total: 0, limit: 50, offset: 0 })),
      getNamedContactById: vi.fn(async () => null),
      createNamedContact: vi.fn(async () => null),
      updateNamedContact: vi.fn(async () => null),
    },
  }
}

describe("identity tools", () => {
  it("publishes the complete non-destructive identity surface", () => {
    expect(identityTools).toHaveLength(12)
    expect(new Set(identityTools.map((tool) => tool.capabilityId)).size).toBe(12)
    expect(identityTools.every((tool) => tool.audience?.allowed?.includes("staff"))).toBe(true)
    expect(identityTools.every((tool) => tool.tier === "sensitive")).toBe(true)
  })

  it("serializes paginated contact records as JSON-safe values", async () => {
    await expect(
      listIdentityContactPointsTool.handler({ limit: 50, offset: 0 }, context()),
    ).resolves.toEqual({
      data: [contactPoint],
      total: 1,
      limit: 50,
      offset: 0,
    })
  })

  it("requires write scope and guarded risk for mutations", () => {
    for (const tool of [createIdentityAddressTool, updateIdentityNamedContactTool]) {
      expect(tool.requiredScopes).toEqual(["identity:write"])
      expect(tool.riskPolicy).toMatchObject({
        destructive: false,
        reversible: true,
        sideEffects: ["data-write"],
      })
    }
  })

  it("registers all capabilities without aliases or duplicate names", () => {
    expect(() => createToolRegistry().registerAll(identityTools)).not.toThrow()
  })
})
