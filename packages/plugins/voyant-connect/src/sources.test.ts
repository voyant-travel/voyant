import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import {
  type ConnectionSummary,
  createVoyantConnectClient,
  type VoyantConnectClient,
} from "@voyant-travel/connect-sdk"
import { describe, expect, it, vi } from "vitest"

import {
  createVoyantConnectSources,
  listVoyantConnectSourceConnections,
  registerVoyantConnectSources,
} from "./sources.js"

describe("createVoyantConnectSources", () => {
  it("creates generic, structured cruise, and TUI package sources per active connection", () => {
    const sources = createVoyantConnectSources({
      client: fakeClient(),
      operatorId: "op_123",
      connections: [{ id: "conn_tui", status: "active", providerKey: "tui" }],
      geo: false,
      destinationNames: false,
    })

    expect(
      sources.map((source) => [source.connectionId, source.role, source.sourceProvider]),
    ).toEqual([
      ["conn_tui", "generic", "tui"],
      ["conn_tui:cruises", "cruises", "tui"],
      ["conn_tui:products", "tui-products", "tui"],
    ])
  })

  it("registers connection-scoped sources on the catalog registry", () => {
    const registry = fakeRegistry()
    const sources = createVoyantConnectSources({
      client: fakeClient(),
      operatorId: "op_123",
      connections: [{ id: "conn_viking", status: "active", supplierName: "Viking" }],
      geo: false,
      destinationNames: false,
    })

    registerVoyantConnectSources(registry, sources)

    expect(registry.register).toHaveBeenCalledTimes(2)
    expect(registry.register).toHaveBeenNthCalledWith(1, "conn_viking", sources[0]?.adapter)
    expect(registry.register).toHaveBeenNthCalledWith(2, "conn_viking:cruises", sources[1]?.adapter)
  })
})

describe("listVoyantConnectSourceConnections", () => {
  it("keeps only active connections and enriches provider details", async () => {
    const client = fakeClient({
      list: [
        fakeConnection({ id: "conn_active", status: "active" }),
        fakeConnection({ id: "conn_paused", status: "paused" }),
      ],
      details: {
        conn_active: fakeConnection({
          id: "conn_active",
          status: "active",
          providerKey: "tui",
          supplierName: "TUI",
        }),
      },
    })

    await expect(
      listVoyantConnectSourceConnections({ client, operatorId: "op_123" }),
    ).resolves.toEqual([
      {
        id: "conn_active",
        status: "active",
        providerKey: "tui",
        supplierName: "TUI",
      },
    ])
  })
})

function fakeRegistry(): SourceAdapterRegistry {
  return {
    register: vi.fn(),
    resolveByConnection: vi.fn(),
    resolveByConnectionOrThrow: vi.fn(),
    resolveOrThrow: vi.fn(),
    byKind: vi.fn(() => []),
    connections: vi.fn(() => []),
    kinds: vi.fn(() => []),
    has: vi.fn(() => false),
    hasKind: vi.fn(() => false),
  } as SourceAdapterRegistry
}

function fakeClient(options?: {
  list?: ConnectionSummary[]
  details?: Record<string, ConnectionSummary>
}): VoyantConnectClient {
  const client = createVoyantConnectClient({
    apiKey: "test",
    operatorId: "op_123",
  })
  client.connections.list = vi.fn(async () => options?.list ?? [])
  client.connections.get = vi.fn(async (_operatorId: string, connectionId: string) => {
    const detail = options?.details?.[connectionId]
    if (!detail) throw new Error("missing detail")
    return detail
  })
  client.products.listOnConnection = vi.fn(async () => [])
  client.accommodations.list = vi.fn(async () => [])
  return client
}

function fakeConnection(overrides: Partial<ConnectionSummary> & { id: string }): ConnectionSummary {
  return {
    id: overrides.id,
    operatorId: overrides.operatorId ?? "op_123",
    supplierName: overrides.supplierName ?? "Supplier",
    providerKey: overrides.providerKey ?? null,
    providerRegistrationId: overrides.providerRegistrationId ?? null,
    status: overrides.status ?? "active",
    market: overrides.market ?? null,
    webhookSigningSecretLast4: overrides.webhookSigningSecretLast4 ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
    metadata: overrides.metadata ?? null,
  }
}
