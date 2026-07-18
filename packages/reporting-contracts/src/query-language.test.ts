import { describe, expect, it } from "vitest"

import { parseReportQuery, ReportQuerySyntaxError } from "./query-language.js"

describe("bounded report query language", () => {
  it("compiles a single-dataset query with filters, grouping, ordering, and a limit", () => {
    expect(
      parseReportQuery(`
        from bookings
        where status in ["confirmed", "completed"] and created_at >= $from
        group by month(created_at)
        select month as month, count() as bookings, sum(sell_amount) as revenue
        order by month asc
        limit 24
      `),
    ).toEqual({
      dataset: { id: "bookings" },
      filters: [
        {
          field: "status",
          operator: "in",
          value: { kind: "literal", value: ["confirmed", "completed"] },
        },
        {
          field: "created_at",
          operator: "greaterThanOrEqual",
          value: { kind: "parameter", name: "from" },
        },
      ],
      groupBy: [{ field: "created_at", timeGrain: "month" }],
      select: [
        { kind: "field", field: "month", as: "month" },
        { kind: "aggregate", operation: "count", as: "bookings" },
        { kind: "aggregate", operation: "sum", field: "sell_amount", as: "revenue" },
      ],
      orderBy: [{ by: "month", direction: "ascending" }],
      limit: 24,
    })
  })

  it.each([
    "from bookings join invoices select count() as rows",
    "delete from bookings",
    "from bookings select *",
    "from bookings select count() as rows; drop table bookings",
    "from (select bookings) select count() as rows",
    "from bookings select revenue + tax as total",
  ])("rejects unsupported or unsafe source: %s", (source) => {
    expect(() => parseReportQuery(source)).toThrow(ReportQuerySyntaxError)
  })
})
