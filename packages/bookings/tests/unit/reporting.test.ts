import { reportQuerySchema } from "@voyant-travel/reporting-contracts"
import { PgDialect, type SQL } from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vitest"
import { bookingsActivityDataset } from "../../src/reporting.js"
import {
  BOOKINGS_ACTIVITY_DATASET_FIELDS,
  BOOKINGS_ACTIVITY_DATASET_ID,
  BOOKINGS_MONTHLY_TREND_WIDGET_ID,
  BOOKINGS_OVERVIEW_TEMPLATE_ID,
  BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID,
  BOOKINGS_TOTAL_WIDGET_ID,
  bookingsReportingDeclaration,
} from "../../src/reporting-definitions.js"
import { bookingsVoyantModule } from "../../src/voyant.js"

function widgetQuery(id: string) {
  const widget = bookingsReportingDeclaration.widgets?.find((candidate) => candidate.id === id)
  if (!widget) throw new Error(`Missing reporting widget ${id}.`)
  return reportQuerySchema.parse({
    dataset: { id: widget.datasetId, version: 1 },
    ...widget.query,
  })
}

describe("bookings reporting dataset", () => {
  it("declares a currency-safe booking-grain semantic surface", () => {
    expect(bookingsActivityDataset.definition).toMatchObject({
      id: BOOKINGS_ACTIVITY_DATASET_ID,
      version: 1,
      grain: "One row per booking record in the current deployment.",
      requiredScopes: ["bookings:read"],
      defaultLimit: 100,
      maximumLimit: 1_000,
    })
    expect(bookingsActivityDataset.definition.fields).toEqual(BOOKINGS_ACTIVITY_DATASET_FIELDS)
    expect(bookingsActivityDataset.definition.fields).not.toContainEqual(
      expect.objectContaining({ id: "sellAmount" }),
    )
  })

  it("executes the total-bookings preset with a server-enforced lookahead limit", async () => {
    let statement: SQL | undefined
    const execute = vi.fn(async (query: SQL) => {
      statement = query
      return [{ report_column_0: "42" }]
    })

    const result = await bookingsActivityDataset.execute(
      { db: { execute }, grantedScopes: ["bookings:read"] },
      { query: widgetQuery(BOOKINGS_TOTAL_WIDGET_ID), parameters: {}, maximumRows: 1 },
    )

    expect(result).toEqual({
      columns: [{ id: "totalBookings", label: "Count", valueType: "integer" }],
      rows: [{ totalBookings: 42 }],
      truncated: false,
      warnings: [],
    })
    expect(execute).toHaveBeenCalledOnce()
    const compiled = new PgDialect().sqlToQuery(statement!)
    expect(compiled.sql).toContain('COUNT(*)::double precision AS "report_column_0"')
    expect(compiled.sql).toContain('FROM "bookings"')
    expect(compiled.sql).toContain("LIMIT $1")
    expect(compiled.params).toEqual([2])
  })

  it("binds validated filters and deterministically groups and orders status counts", async () => {
    let statement: SQL | undefined
    const execute = vi.fn(async (query: SQL) => {
      statement = query
      return [
        { report_column_0: "confirmed", report_column_1: 7 },
        { report_column_0: "completed", report_column_1: 3 },
      ]
    })

    const result = await bookingsActivityDataset.execute(
      { db: { execute }, grantedScopes: ["bookings:read"] },
      {
        query: {
          dataset: { id: BOOKINGS_ACTIVITY_DATASET_ID, version: 1 },
          select: [
            { kind: "field", field: "status" },
            { kind: "aggregate", operation: "count", as: "totalBookings" },
          ],
          filters: [
            {
              field: "status",
              operator: "in",
              value: { kind: "parameter", name: "statuses" },
            },
          ],
          groupBy: [{ field: "status" }],
          orderBy: [{ by: "totalBookings", direction: "descending" }],
          limit: 10,
        },
        parameters: { statuses: ["confirmed", "completed"] },
        maximumRows: 10,
      },
    )

    expect(result.rows).toEqual([
      { status: "confirmed", totalBookings: 7 },
      { status: "completed", totalBookings: 3 },
    ])
    const compiled = new PgDialect().sqlToQuery(statement!)
    expect(compiled.sql).toContain('WHERE "bookings"."status" IN ($1, $2)')
    expect(compiled.sql).toContain('GROUP BY "bookings"."status"')
    expect(compiled.sql).toContain("ORDER BY COUNT(*)::double precision DESC")
    expect(compiled.params).toEqual(["confirmed", "completed", 11])
  })

  it("rejects missing scope and unsupported query shapes before querying", async () => {
    const execute = vi.fn()

    await expect(
      bookingsActivityDataset.execute(
        { db: { execute }, grantedScopes: [] },
        { query: widgetQuery(BOOKINGS_TOTAL_WIDGET_ID), parameters: {}, maximumRows: 1 },
      ),
    ).rejects.toThrow("Missing required dataset scope: bookings:read")

    await expect(
      bookingsActivityDataset.execute(
        { db: { execute }, grantedScopes: ["bookings:read"] },
        {
          query: {
            dataset: { id: BOOKINGS_ACTIVITY_DATASET_ID },
            select: [
              { kind: "field", field: "sourceType" },
              { kind: "aggregate", operation: "count", as: "totalBookings" },
            ],
            filters: [],
            groupBy: [{ field: "status" }],
            orderBy: [],
          },
          parameters: {},
          maximumRows: 10,
        },
      ),
    ).rejects.toThrow('Selected field "sourceType" must be included in groupBy')
    expect(execute).not.toHaveBeenCalled()
  })

  it("marks lookahead results as truncated and never returns beyond the requested maximum", async () => {
    const execute = vi.fn(async () => [
      { report_column_0: "confirmed", report_column_1: 7 },
      { report_column_0: "completed", report_column_1: 3 },
    ])

    const result = await bookingsActivityDataset.execute(
      { db: { execute }, grantedScopes: ["bookings:read"] },
      {
        query: widgetQuery(BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID),
        parameters: {},
        maximumRows: 1,
      },
    )

    expect(result.rows).toEqual([{ status: "confirmed", totalBookings: 7 }])
    expect(result.truncated).toBe(true)
  })
})

describe("bookings reporting manifest", () => {
  it("declares three presets and a full-page overview from one import-cheap facet", () => {
    expect(bookingsReportingDeclaration.widgets?.map(({ id }) => id)).toEqual([
      BOOKINGS_TOTAL_WIDGET_ID,
      BOOKINGS_MONTHLY_TREND_WIDGET_ID,
      BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID,
    ])
    expect(bookingsReportingDeclaration.templates).toEqual([
      expect.objectContaining({ id: BOOKINGS_OVERVIEW_TEMPLATE_ID, version: 1 }),
    ])
    expect(bookingsVoyantModule.reporting).toBe(bookingsReportingDeclaration)
  })

  it("keeps the source-free descriptor aligned with the lazy runtime dataset", () => {
    const manifestDataset = bookingsReportingDeclaration.datasets?.[0]
    expect(manifestDataset).toMatchObject({
      id: bookingsActivityDataset.definition.id,
      version: bookingsActivityDataset.definition.version,
      requiredScopes: bookingsActivityDataset.definition.requiredScopes,
      descriptor: {
        grain: bookingsActivityDataset.definition.grain,
        fields: bookingsActivityDataset.definition.fields,
        defaultLimit: bookingsActivityDataset.definition.defaultLimit,
        maximumLimit: bookingsActivityDataset.definition.maximumLimit,
      },
      runtime: {
        entry: "@voyant-travel/bookings/reporting",
        export: "bookingsActivityDataset",
      },
    })
  })
})
