import type { VoyantGraphReportingDeclaration } from "@voyant-travel/core/project"

export const BOOKINGS_ACTIVITY_DATASET_ID = "bookings.activity"
export const BOOKINGS_TOTAL_WIDGET_ID = "bookings.widget.total"
export const BOOKINGS_MONTHLY_TREND_WIDGET_ID = "bookings.widget.monthly-trend"
export const BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID = "bookings.widget.status-breakdown"
export const BOOKINGS_OVERVIEW_TEMPLATE_ID = "bookings.template.overview"

export const BOOKINGS_ACTIVITY_DATASET_FIELDS = [
  {
    id: "createdAt",
    label: "Created at",
    description: "The instant at which the booking record was created.",
    role: "dimension",
    valueType: "datetime",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["minimum", "maximum"],
  },
  {
    id: "status",
    label: "Status",
    description: "The current booking lifecycle status.",
    role: "dimension",
    valueType: "string",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["countDistinct"],
  },
  {
    id: "sourceType",
    label: "Source",
    description: "The channel through which the booking originated.",
    role: "dimension",
    valueType: "string",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["countDistinct"],
  },
  {
    id: "startDate",
    label: "Start date",
    description: "The booking-level service start date, when known.",
    role: "dimension",
    valueType: "date",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["minimum", "maximum"],
  },
  {
    id: "endDate",
    label: "End date",
    description: "The booking-level service end date, when known.",
    role: "dimension",
    valueType: "date",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["minimum", "maximum"],
  },
  {
    id: "pax",
    label: "Passengers",
    description: "The booking-level passenger count, when known.",
    role: "measure",
    valueType: "integer",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["sum", "average", "minimum", "maximum"],
  },
  {
    id: "sellCurrency",
    label: "Sell currency",
    description: "The currency in which the booking was sold.",
    role: "dimension",
    valueType: "string",
    sensitivity: "internal",
    requiredScopes: [],
    aggregations: ["countDistinct"],
  },
] as const

export const bookingsReportingDeclaration = {
  datasets: [
    {
      id: BOOKINGS_ACTIVITY_DATASET_ID,
      version: 1,
      label: "Booking activity",
      description:
        "Booking-owned activity facts for bounded operational reporting. Monetary amounts are intentionally excluded because sell currencies cannot be added without an explicit normalization policy.",
      descriptor: {
        grain: "One row per booking record in the current deployment.",
        fields: BOOKINGS_ACTIVITY_DATASET_FIELDS,
        defaultLimit: 100,
        maximumLimit: 1_000,
      },
      requiredScopes: ["bookings:read"],
      runtime: {
        entry: "@voyant-travel/bookings/reporting",
        export: "bookingsActivityDataset",
      },
    },
  ],
  widgets: [
    {
      id: BOOKINGS_TOTAL_WIDGET_ID,
      version: 1,
      label: "Total bookings",
      description: "Total booking records matching the report filters.",
      datasetId: BOOKINGS_ACTIVITY_DATASET_ID,
      query: {
        select: [{ kind: "aggregate", operation: "count", as: "totalBookings" }],
        filters: [],
        groupBy: [],
        orderBy: [],
        limit: 1,
      },
      visualization: { type: "kpi", options: { value: "totalBookings" } },
      defaultSize: { width: 3, height: 2 },
      minSize: { width: 2, height: 2 },
      maxSize: { width: 6, height: 4 },
    },
    {
      id: BOOKINGS_MONTHLY_TREND_WIDGET_ID,
      version: 1,
      label: "Monthly booking trend",
      description: "Booking records created in each of the latest 24 represented months.",
      datasetId: BOOKINGS_ACTIVITY_DATASET_ID,
      query: {
        select: [
          { kind: "field", field: "createdAt", as: "month" },
          { kind: "aggregate", operation: "count", as: "totalBookings" },
        ],
        filters: [],
        groupBy: [{ field: "createdAt", timeGrain: "month" }],
        orderBy: [{ by: "month", direction: "descending" }],
        limit: 24,
      },
      visualization: {
        type: "line",
        options: {
          category: "month",
          value: "totalBookings",
          reverseCategoryOrder: true,
        },
      },
      defaultSize: { width: 7, height: 4 },
      minSize: { width: 4, height: 3 },
      maxSize: { width: 12, height: 8 },
    },
    {
      id: BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID,
      version: 1,
      label: "Bookings by status",
      description: "Current booking records grouped by lifecycle status.",
      datasetId: BOOKINGS_ACTIVITY_DATASET_ID,
      query: {
        select: [
          { kind: "field", field: "status" },
          { kind: "aggregate", operation: "count", as: "totalBookings" },
        ],
        filters: [],
        groupBy: [{ field: "status" }],
        orderBy: [{ by: "totalBookings", direction: "descending" }],
        limit: 20,
      },
      visualization: { type: "pie", options: { category: "status", value: "totalBookings" } },
      defaultSize: { width: 5, height: 4 },
      minSize: { width: 4, height: 3 },
      maxSize: { width: 8, height: 8 },
    },
  ],
  templates: [
    {
      id: BOOKINGS_OVERVIEW_TEMPLATE_ID,
      version: 1,
      label: "Bookings overview",
      description: "A reusable overview of booking volume, trend, and lifecycle status.",
      requirements: [
        { kind: "dataset", id: BOOKINGS_ACTIVITY_DATASET_ID },
        { kind: "widget", id: BOOKINGS_TOTAL_WIDGET_ID },
        { kind: "widget", id: BOOKINGS_MONTHLY_TREND_WIDGET_ID },
        { kind: "widget", id: BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID },
      ],
      widgets: [
        {
          id: "total-bookings",
          widgetId: BOOKINGS_TOTAL_WIDGET_ID,
          layout: { x: 0, y: 0, width: 3, height: 2 },
        },
        {
          id: "monthly-booking-trend",
          widgetId: BOOKINGS_MONTHLY_TREND_WIDGET_ID,
          layout: { x: 0, y: 2, width: 7, height: 4 },
        },
        {
          id: "booking-status-breakdown",
          widgetId: BOOKINGS_STATUS_BREAKDOWN_WIDGET_ID,
          layout: { x: 7, y: 2, width: 5, height: 4 },
        },
      ],
    },
  ],
} as const satisfies VoyantGraphReportingDeclaration
