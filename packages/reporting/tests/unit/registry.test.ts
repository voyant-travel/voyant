import type { ReportingContributionRuntime } from "@voyant-travel/reporting-contracts"
import { describe, expect, it, vi } from "vitest"

import { ReportingRegistry } from "../../src/registry.js"

function contribution(): ReportingContributionRuntime {
  return {
    namespace: "test",
    datasets: [
      {
        definition: {
          id: "bookings",
          version: 1,
          label: "Bookings",
          grain: "One row per booking",
          requiredScopes: ["bookings:read"],
          fields: [
            {
              id: "status",
              label: "Status",
              role: "dimension",
              valueType: "string",
              sensitivity: "internal",
              requiredScopes: [],
              aggregations: ["count", "countDistinct"],
            },
          ],
          defaultLimit: 100,
          maximumLimit: 500,
        },
        execute: vi.fn(async () => ({
          columns: [{ id: "status", label: "Status", valueType: "string" as const }],
          rows: [{ status: "confirmed" }],
          truncated: false,
          warnings: [],
        })),
      },
    ],
    widgets: [
      {
        id: "bookings.by-status",
        version: 1,
        label: "Bookings by status",
        query: {
          dataset: { id: "bookings" },
          select: [{ kind: "field", field: "status" }],
          filters: [],
          groupBy: [],
          orderBy: [],
        },
        visualization: { type: "table", options: {} },
        defaultSize: { width: 6, height: 4 },
      },
    ],
  }
}

describe("ReportingRegistry", () => {
  it("executes only declared fields after checking the dataset scope", async () => {
    const registry = new ReportingRegistry([contribution()])
    await expect(
      registry.executeQuery({
        db: {},
        grantedScopes: ["bookings:read"],
        query: {
          dataset: { id: "bookings" },
          select: [{ kind: "field", field: "status" }],
          filters: [],
          groupBy: [],
          orderBy: [],
        },
      }),
    ).resolves.toMatchObject({ rows: [{ status: "confirmed" }] })

    expect(() =>
      registry.validateQuery(
        {
          dataset: { id: "bookings" },
          select: [{ kind: "field", field: "status" }],
          filters: [],
          groupBy: [],
          orderBy: [],
        },
        ["reports:read"],
      ),
    ).toThrow("Missing required dataset scopes")
  })

  it("omits unavailable widgets in view mode but preserves removable placeholders in edit mode", () => {
    const registry = new ReportingRegistry([contribution()])
    const draft = {
      parameters: {},
      widgets: [
        {
          id: "available",
          source: { kind: "preset" as const, widgetId: "bookings.by-status" },
          layout: { x: 0, y: 0, width: 6, height: 4 },
        },
        {
          id: "missing",
          source: { kind: "preset" as const, widgetId: "finance.revenue" },
          layout: { x: 6, y: 0, width: 6, height: 4 },
        },
      ],
    }

    expect(registry.resolveDraft(draft, "view").map(({ instance }) => instance.id)).toEqual([
      "available",
    ])
    expect(registry.resolveDraft(draft, "edit")).toEqual([
      expect.objectContaining({ status: "available" }),
      expect.objectContaining({
        status: "missing",
        missingReason: expect.stringContaining("finance.revenue"),
      }),
    ])
  })
})
