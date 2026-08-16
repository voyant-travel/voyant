import type {
  ReportDatasetContribution,
  ReportDatasetExecutionInput,
  ReportParameters,
  ReportResult,
} from "@voyant-travel/reporting-contracts"
import { ReportDatasetQueryError } from "@voyant-travel/reporting-contracts"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"
import { type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  FINANCE_UNPERFORMED_SERVICES_DATASET_ID,
  financeUnperformedServicesDatasetDefinition,
} from "./reporting-definitions.js"
import {
  compileFinanceReportQuery,
  type FinanceReportRelationSpec,
} from "./reporting-query-compiler.js"
import { executeBoundaryRows } from "./service-boundary-sql.js"

/** A query shape or period outside this dataset's surface. */
export class FinanceUnperformedServicesQueryError extends ReportDatasetQueryError {
  constructor(message: string) {
    super(message)
    this.name = "FinanceUnperformedServicesQueryError"
  }
}

export const PERIOD_START_PARAM = "periodStart"
export const PERIOD_END_PARAM = "periodEnd"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const MONEY_FIELDS = new Set([
  "contractValueCents",
  "contractValueReportingCents",
  "advancesStrictReportingCents",
  "collectionsTotalReportingCents",
  "balanceReportingCents",
  "invoicedNotCollectedReportingCents",
])

const fieldSql: Readonly<Record<string, SQL>> = {
  bookingId: sql`contract."bookingId"`,
  bookingNumber: sql`contract."bookingNumber"`,
  clientName: sql`contract."clientName"`,
  confirmedAt: sql`contract."confirmedAt"`,
  firstServiceDate: sql`contract."firstServiceDate"`,
  lastServiceDate: sql`contract."lastServiceDate"`,
  status: sql`contract.status`,
  sellCurrency: sql`contract."sellCurrency"`,
  reportingCurrency: sql`contract."reportingCurrency"`,
  fxRateSetId: sql`contract."fxRateSetId"`,
  fxRateApplied: sql`contract."fxRateApplied"`,
  contractValueCents: sql`contract."contractValueCents"`,
  contractValueReportingCents: sql`contract."contractValueReportingCents"`,
  advancesStrictReportingCents: sql`contract."advancesStrictReportingCents"`,
  collectionsTotalReportingCents: sql`contract."collectionsTotalReportingCents"`,
  balanceReportingCents: sql`contract."balanceReportingCents"`,
  invoicedNotCollectedReportingCents: sql`contract."invoicedNotCollectedReportingCents"`,
}

/**
 * Bookings whose contracted services are not fully performed at period end,
 * with value and collections expressed at the rate their own documents were
 * stamped with (voyant#4704).
 *
 * Three things about the shape:
 *
 * **Period membership is two bounds on two different fields.** Concluded on or
 * before period end, services running on or after period start. That is why this
 * dataset takes the period as parameters instead of declaring a
 * `defaultDateField` — the page-level window is one field with both bounds and
 * would answer a different question while looking like it answered this one.
 *
 * **The reporting currency comes from the documents, not from a setting.** A
 * setting can change; what the operator filed cannot. `payments.reporting_currency`
 * and `invoices.base_currency` are stamped at the moment each document is
 * written, so they are what the converted columns are denominated in.
 *
 * **Nothing is converted at read time.** A contract with no stamped document
 * reports a null converted value rather than a rate looked up now, because a
 * figure derived at read time is exactly what voyant#4703 exists to stop. The
 * executor counts those rows and warns, so a total is never quietly short.
 */
function unperformedServicesRelation(periodStart: string, periodEnd: string): SQL {
  return sql`
    SELECT
      booking.id AS "bookingId",
      booking.booking_number AS "bookingNumber",
      coalesce(
        organization.name,
        nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''),
        nullif(trim(concat_ws(' ', booking.contact_first_name, booking.contact_last_name)), '')
      ) AS "clientName",
      booking.confirmed_at::date AS "confirmedAt",
      service.first_service_date AS "firstServiceDate",
      service.last_service_date AS "lastServiceDate",
      booking.status::text AS status,
      booking.sell_currency AS "sellCurrency",
      stamp.reporting_currency AS "reportingCurrency",
      stamp.fx_rate_set_id AS "fxRateSetId",
      stamp.rate_applied AS "fxRateApplied",
      coalesce(booking.sell_amount_cents, 0)::bigint AS "contractValueCents",
      stamp.contract_value_reporting_cents AS "contractValueReportingCents",
      CASE
        WHEN stamp.contract_value_reporting_cents IS NULL THEN NULL
        WHEN collected.collections_cents < stamp.contract_value_reporting_cents
          THEN collected.collections_cents
        ELSE 0
      END::bigint AS "advancesStrictReportingCents",
      collected.collections_cents::bigint AS "collectionsTotalReportingCents",
      CASE
        WHEN stamp.contract_value_reporting_cents IS NULL THEN NULL
        ELSE greatest(stamp.contract_value_reporting_cents - collected.collections_cents, 0)
      END::bigint AS "balanceReportingCents",
      greatest(collected.fiscal_invoiced_cents - collected.collections_cents, 0)::bigint
        AS "invoicedNotCollectedReportingCents"
    FROM bookings booking
    LEFT JOIN people person ON person.id = booking.person_id
    LEFT JOIN organizations organization ON organization.id = booking.organization_id
    JOIN LATERAL (
      SELECT
        min(item.service_date) AS first_service_date,
        max(item.service_date) AS last_service_date
      FROM booking_items item
      WHERE item.booking_id = booking.id
        AND item.service_date IS NOT NULL
    ) service ON true
    LEFT JOIN LATERAL (
      SELECT
        -- Collections net of reversals, at each payment's own stamped rate.
        -- A departure cancelled and refunded inside the period therefore
        -- contributes its contract and value but nothing to advances.
        coalesce(sum(
          CASE payment.status
            WHEN 'completed' THEN payment.reporting_amount_cents
            WHEN 'refunded' THEN -payment.reporting_amount_cents
            ELSE 0
          END
        ), 0)::bigint AS collections_cents,
        -- A fiscal invoice means the money was taken. Counted separately so a
        -- gap against recorded payments is visible rather than assumed away.
        coalesce(sum(
          CASE
            WHEN invoice.invoice_type = 'invoice'
              AND invoice.status <> 'void'
              AND invoice.base_total_cents IS NOT NULL
              THEN invoice.base_total_cents
            ELSE 0
          END
        ), 0)::bigint AS fiscal_invoiced_cents
      FROM invoices invoice
      LEFT JOIN payments payment
        ON payment.invoice_id = invoice.id
        AND payment.payment_date <= ${periodEnd}::date
        AND payment.reporting_amount_cents IS NOT NULL
      WHERE invoice.booking_id = booking.id
        AND invoice.status <> 'void'
    ) collected ON true
    LEFT JOIN LATERAL (
      -- The rate this contract's own paperwork was stamped at. Preferring a
      -- payment over an invoice is deliberate: a deposit is usually the first
      -- document a contract gets, and it is the rate the customer was quoted.
      SELECT
        stamped.reporting_currency,
        stamped.fx_rate_set_id,
        CASE
          WHEN booking.sell_currency = stamped.reporting_currency THEN 1
          ELSE coalesce(rate.effective_rate_decimal, rate.rate_decimal)
        END AS rate_applied,
        CASE
          WHEN booking.sell_amount_cents IS NULL THEN NULL
          WHEN booking.sell_currency = stamped.reporting_currency
            THEN booking.sell_amount_cents::bigint
          WHEN coalesce(rate.effective_rate_decimal, rate.rate_decimal) IS NULL THEN NULL
          ELSE round(
            booking.sell_amount_cents * coalesce(rate.effective_rate_decimal, rate.rate_decimal)
          )::bigint
        END AS contract_value_reporting_cents
      FROM (
        SELECT payment.reporting_currency, payment.reporting_fx_rate_set_id AS fx_rate_set_id,
               payment.payment_date AS stamped_on, 0 AS precedence
        FROM payments payment
        JOIN invoices invoice ON invoice.id = payment.invoice_id
        WHERE invoice.booking_id = booking.id
          AND payment.reporting_currency IS NOT NULL
        UNION ALL
        SELECT invoice.base_currency, invoice.fx_rate_set_id, invoice.issue_date, 1
        FROM invoices invoice
        WHERE invoice.booking_id = booking.id
          AND invoice.status <> 'void'
          AND invoice.base_currency IS NOT NULL
      ) stamped
      LEFT JOIN exchange_rates rate
        ON rate.fx_rate_set_id = stamped.fx_rate_set_id
        AND rate.base_currency = booking.sell_currency
        AND rate.quote_currency = stamped.reporting_currency
      ORDER BY stamped.precedence, stamped.stamped_on
      LIMIT 1
    ) stamp ON true
    WHERE booking.confirmed_at IS NOT NULL
      AND booking.confirmed_at::date <= ${periodEnd}::date
      AND service.last_service_date >= ${periodStart}::date
  `
}

const unperformedServicesSpec: FinanceReportRelationSpec = {
  datasetId: FINANCE_UNPERFORMED_SERVICES_DATASET_ID,
  version: 1,
  fields: financeUnperformedServicesDatasetDefinition.fields,
  alias: "contract",
  relation: (parameters) => {
    const periodStart = requirePeriodBound(parameters, PERIOD_START_PARAM)
    const periodEnd = requirePeriodBound(parameters, PERIOD_END_PARAM)
    if (periodEnd < periodStart) {
      throw new FinanceUnperformedServicesQueryError(
        `${PERIOD_END_PARAM} must not precede ${PERIOD_START_PARAM}.`,
      )
    }
    return unperformedServicesRelation(periodStart, periodEnd)
  },
  fieldSql,
  moneyFields: MONEY_FIELDS,
  currencyDimension: "reportingCurrency",
  error: (message) => new FinanceUnperformedServicesQueryError(message),
}

export function compileFinanceUnperformedServicesQuery(input: ReportDatasetExecutionInput): {
  statement: SQL
  columns: ReportResult["columns"]
  rowLimit: number
} {
  return compileFinanceReportQuery(unperformedServicesSpec, input)
}

export const financeUnperformedServicesDataset: ReportDatasetContribution = {
  definition: financeUnperformedServicesDatasetDefinition,
  async execute(context, input) {
    if (
      !hasApiKeyPermission(permissionStringsToPermissions(context.grantedScopes), "finance", "read")
    ) {
      throw new FinanceUnperformedServicesQueryError(
        "finance:read is required to query unperformed services.",
      )
    }
    if (context.signal?.aborted) throw abortReason(context.signal)
    const compiled = compileFinanceUnperformedServicesQuery(input)
    const rows = await executeBoundaryRows<Record<string, unknown>>(
      context.db as PostgresJsDatabase,
      compiled.statement,
    )
    if (context.signal?.aborted) throw abortReason(context.signal)
    const truncated = rows.length > compiled.rowLimit
    const visible = rows.slice(0, compiled.rowLimit)
    return {
      columns: compiled.columns,
      rows: visible.map((row) => normalizeRow(row, compiled.columns)),
      truncated,
      warnings: unconvertedWarnings(visible, compiled.columns),
    }
  },
}

/**
 * A total that silently omits the contracts nothing has stamped reads as
 * complete when it is short. Say so instead — and the remedy is the FX stamp
 * routes from voyant#4703, not a rate invented here.
 */
function unconvertedWarnings(
  rows: readonly Record<string, unknown>[],
  columns: ReportResult["columns"],
): string[] {
  const converted = columns.find((column) => column.id.includes("Reporting"))
  if (!converted) return []
  const unconverted = rows.filter((row) => row[converted.id] === null).length
  if (unconverted === 0) return []
  return [
    `${unconverted} of ${rows.length} contracts have no stamped reporting-currency value and are excluded from the converted totals. Stamp them to include them.`,
  ]
}

function requirePeriodBound(parameters: ReportParameters, name: string): string {
  const value = parameters[name]
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new FinanceUnperformedServicesQueryError(
      `${name} is required and must be a YYYY-MM-DD date.`,
    )
  }
  return value
}

function normalizeRow(
  row: Record<string, unknown>,
  columns: ReportResult["columns"],
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  for (const column of columns) {
    const value = row[column.id]
    if (value === undefined || value === null) {
      normalized[column.id] = null
      continue
    }
    if (column.valueType === "date" || column.valueType === "datetime") {
      normalized[column.id] = value instanceof Date ? value.toISOString().slice(0, 10) : value
      continue
    }
    if (
      column.valueType === "integer" ||
      column.valueType === "number" ||
      column.valueType === "currency"
    ) {
      normalized[column.id] = typeof value === "string" ? Number(value) : value
      continue
    }
    normalized[column.id] = value
  }
  return normalized
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("Report query aborted.")
}
