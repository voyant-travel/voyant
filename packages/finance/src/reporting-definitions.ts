import type {
  ReportDatasetDefinition,
  ReportTemplateDefinition,
  ReportWidgetDefinition,
} from "@voyant-travel/reporting-contracts"

export const FINANCE_RECEIVABLES_DATASET_ID = "finance.receivables"

/**
 * Finance-owned semantics for issued customer receivables.
 *
 * Amounts remain in the document currency. Consumers must group by currency
 * or constrain a query to one currency; the executor enforces that invariant.
 */
export const financeReceivablesDatasetDefinition = {
  id: FINANCE_RECEIVABLES_DATASET_ID,
  version: 1,
  label: "Receivables",
  description:
    "Final, non-void customer invoices with issued credit notes and completed or refunded collections attributed in the invoice currency. Proformas and draft documents are excluded.",
  grain: "One issued, partially paid, paid, or overdue final customer invoice.",
  requiredScopes: ["finance:read"],
  defaultLimit: 100,
  maximumLimit: 1_000,
  defaultDateField: "issueDate",
  fields: [
    {
      id: "issueDate",
      label: "Issue date",
      description: "The final invoice issue date; trends bucket this date in UTC calendar units.",
      role: "dimension",
      valueType: "date",
      sensitivity: "internal",
      requiredScopes: ["finance:read"],
      aggregations: [],
    },
    {
      id: "dueDate",
      label: "Due date",
      role: "dimension",
      valueType: "date",
      sensitivity: "internal",
      requiredScopes: ["finance:read"],
      aggregations: [],
    },
    {
      id: "status",
      label: "Invoice status",
      description:
        "Current status of the final invoice; draft, pending allocation, and void documents are outside this dataset.",
      role: "dimension",
      valueType: "string",
      sensitivity: "internal",
      requiredScopes: ["finance:read"],
      aggregations: ["count", "countDistinct"],
    },
    {
      id: "currency",
      label: "Document currency",
      description: "ISO currency of the final invoice. No report-time FX conversion is applied.",
      role: "dimension",
      valueType: "string",
      sensitivity: "internal",
      requiredScopes: ["finance:read"],
      aggregations: ["count", "countDistinct"],
    },
    {
      id: "grossIssuedCents",
      label: "Gross issued",
      description:
        "Final invoice total before issued or applied credit notes, in document-currency minor units.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
    {
      id: "creditedCents",
      label: "Credited",
      description:
        "Issued or applied credit notes converted with their persisted invoice-currency snapshot, in minor units.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
    {
      id: "netIssuedCents",
      label: "Net issued",
      description:
        "Gross final invoice value less issued or applied credit notes, attributed to the final invoice issue date.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
    {
      id: "settledCents",
      label: "Settled",
      description:
        "Payments whose current status is completed, converted with their persisted invoice-currency snapshot.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
    {
      id: "refundedCents",
      label: "Refunded",
      description:
        "Payments whose current status is refunded, converted with their persisted invoice-currency snapshot.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
    {
      id: "outstandingBalanceCents",
      label: "Outstanding balance",
      description:
        "Net issued value less currently completed payments, floored at zero, in document-currency minor units.",
      role: "measure",
      valueType: "currency",
      sensitivity: "sensitive",
      requiredScopes: ["finance:read"],
      aggregations: ["sum"],
    },
  ],
} satisfies ReportDatasetDefinition

export const financeReportingWidgets = [
  {
    id: "finance.outstanding-by-currency",
    version: 1,
    label: "Outstanding by currency",
    description: "Current unpaid final-invoice balance, kept separate by document currency.",
    query: {
      dataset: { id: FINANCE_RECEIVABLES_DATASET_ID, version: 1 },
      select: [
        { kind: "field", field: "currency" },
        {
          kind: "aggregate",
          operation: "sum",
          field: "outstandingBalanceCents",
          as: "outstandingBalanceCents",
        },
        { kind: "aggregate", operation: "count", as: "invoiceCount" },
      ],
      filters: [],
      groupBy: [{ field: "currency" }],
      orderBy: [{ by: "outstandingBalanceCents", direction: "descending" }],
      limit: 20,
    },
    visualization: {
      type: "bar",
      options: {
        category: "currency",
        value: "outstandingBalanceCents",
        currencyField: "currency",
        minorUnit: true,
      },
    },
    defaultSize: { width: 4, height: 3 },
    minimumSize: { width: 3, height: 2 },
    maximumSize: { width: 12, height: 8 },
  },
  {
    id: "finance.net-issued-trend",
    version: 1,
    label: "Net issued trend",
    description:
      "Final invoices less issued/applied credit notes, attributed to the invoice issue month and separated by currency.",
    query: {
      dataset: { id: FINANCE_RECEIVABLES_DATASET_ID, version: 1 },
      select: [
        { kind: "field", field: "issueDate", as: "issueMonth" },
        { kind: "field", field: "currency" },
        {
          kind: "aggregate",
          operation: "sum",
          field: "netIssuedCents",
          as: "netIssuedCents",
        },
      ],
      filters: [],
      groupBy: [{ field: "issueDate", timeGrain: "month" }, { field: "currency" }],
      orderBy: [
        { by: "issueMonth", direction: "ascending" },
        { by: "currency", direction: "ascending" },
      ],
      limit: 240,
    },
    visualization: {
      type: "line",
      options: {
        x: "issueMonth",
        y: "netIssuedCents",
        series: "currency",
        currencyField: "currency",
        minorUnit: true,
      },
    },
    defaultSize: { width: 8, height: 3 },
    minimumSize: { width: 4, height: 3 },
    maximumSize: { width: 12, height: 8 },
  },
  {
    id: "finance.invoice-status-breakdown",
    version: 1,
    label: "Final invoice status",
    description: "Count of recognized final invoices by their current receivable status.",
    query: {
      dataset: { id: FINANCE_RECEIVABLES_DATASET_ID, version: 1 },
      select: [
        { kind: "field", field: "status" },
        { kind: "aggregate", operation: "count", as: "invoiceCount" },
      ],
      filters: [],
      groupBy: [{ field: "status" }],
      orderBy: [{ by: "invoiceCount", direction: "descending" }],
      limit: 10,
    },
    visualization: { type: "pie", options: { category: "status", value: "invoiceCount" } },
    defaultSize: { width: 4, height: 3 },
    minimumSize: { width: 3, height: 3 },
    maximumSize: { width: 8, height: 8 },
  },
  {
    id: "finance.collections-by-currency",
    version: 1,
    label: "Collections by currency",
    description: "Currently completed and refunded customer payments attributed to final invoices.",
    query: {
      dataset: { id: FINANCE_RECEIVABLES_DATASET_ID, version: 1 },
      select: [
        { kind: "field", field: "currency" },
        { kind: "aggregate", operation: "sum", field: "settledCents", as: "settledCents" },
        { kind: "aggregate", operation: "sum", field: "refundedCents", as: "refundedCents" },
      ],
      filters: [],
      groupBy: [{ field: "currency" }],
      orderBy: [{ by: "settledCents", direction: "descending" }],
      limit: 20,
    },
    visualization: {
      type: "table",
      options: { currencyField: "currency", minorUnit: true },
    },
    defaultSize: { width: 4, height: 3 },
    minimumSize: { width: 4, height: 2 },
    maximumSize: { width: 12, height: 8 },
  },
] satisfies readonly ReportWidgetDefinition[]

export const financeReportingTemplates = [
  {
    id: "finance.overview",
    version: 1,
    label: "Finance overview",
    description:
      "Issued value, collections, outstanding receivables, and current final-invoice status.",
    parameters: [],
    widgets: [
      {
        id: "outstanding",
        source: { kind: "preset", widgetId: "finance.outstanding-by-currency", version: 1 },
        layout: { x: 0, y: 0, width: 4, height: 3 },
      },
      {
        id: "net-issued",
        source: { kind: "preset", widgetId: "finance.net-issued-trend", version: 1 },
        layout: { x: 4, y: 0, width: 8, height: 3 },
      },
      {
        id: "status",
        source: { kind: "preset", widgetId: "finance.invoice-status-breakdown", version: 1 },
        layout: { x: 0, y: 3, width: 4, height: 3 },
      },
      {
        id: "collections",
        source: { kind: "preset", widgetId: "finance.collections-by-currency", version: 1 },
        layout: { x: 4, y: 3, width: 8, height: 3 },
      },
    ],
  },
] satisfies readonly ReportTemplateDefinition[]
