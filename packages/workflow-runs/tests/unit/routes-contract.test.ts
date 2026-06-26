import type { workflowRunSteps, workflowRuns } from "@voyant-travel/workflow-runs/schema"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

/**
 * Response contract tests (voyant#2114 — workflow-runs sub-batch) for the
 * workflow-runs admin routes. Each Drizzle-backed fixture is typed as the real
 * `$inferSelect` row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in `routes.ts`
 * (§17: timestamp columns → strings; jsonb `input`/`result`/`output` are open
 * records; the compact error payload is an optional-keyed object).
 *
 * The list service returns `{ data, total, limit, offset }` (a real `total`
 * count read), so the list envelope is the canonical `listResponseSchema`. The
 * single-run GET returns the run extended with its ordered `steps` collection.
 */

const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown()).nullable()

const workflowRunErrorSchema = z
  .object({
    message: z.string(),
    code: z.string().optional(),
    stepName: z.string().optional(),
    stack: z.string().optional(),
  })
  .nullable()

const workflowRunSchema = z.object({
  id: z.string(),
  workflowName: z.string(),
  trigger: z.string(),
  correlationId: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  input: jsonRecord,
  result: jsonRecord,
  error: workflowRunErrorSchema,
  parentRunId: z.string().nullable(),
  triggeredByUserId: z.string().nullable(),
  resumeFromStep: z.string().nullable(),
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  durationMs: z.number().int().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const workflowRunStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  stepName: z.string(),
  sequence: z.number().int(),
  status: z.enum(["running", "succeeded", "failed", "skipped", "compensated"]),
  output: jsonRecord,
  error: workflowRunErrorSchema,
  startedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  durationMs: z.number().int().nullable(),
})

const listEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const startedAt = new Date("2026-01-01T00:00:00.000Z")
const completedAt = new Date("2026-01-01T00:05:00.000Z")

// Drizzle-backed rows — typed so a column rename/retype breaks compilation.
const runRow: InferSelectModel<typeof workflowRuns> = {
  id: "workflow_runs_000000000000000000000000",
  workflowName: "checkout-finalize",
  trigger: "admin",
  correlationId: "corr_123",
  tags: ["source:admin", "bookingId:bk_123"],
  status: "succeeded",
  input: { bookingId: "bk_123" },
  result: { queued: true },
  error: null,
  parentRunId: null,
  triggeredByUserId: "user_123",
  resumeFromStep: null,
  startedAt,
  completedAt,
  durationMs: 300_000,
  createdAt,
  updatedAt,
}

const stepRow: InferSelectModel<typeof workflowRunSteps> = {
  id: "workflow_run_steps_00000000000000000000",
  runId: runRow.id,
  stepName: "reserve-inventory",
  sequence: 1,
  status: "succeeded",
  output: { reservationId: "res_1" },
  error: null,
  startedAt,
  completedAt,
  durationMs: 1_200,
}

const pagination = { total: 1, limit: 50, offset: 0 } as const

describe("workflow-runs Drizzle-backed response contracts", () => {
  it("the run { data } envelope satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: runRow }))
    const parsed = z.object({ data: workflowRunSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the step row satisfies the declared schema", () => {
    const wire = JSON.parse(JSON.stringify(stepRow))
    const parsed = workflowRunStepSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the run list envelope satisfies the declared { data, total, limit, offset } schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: [runRow], ...pagination }))
    const parsed = listEnvelope(workflowRunSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the run detail { data } envelope carries its ordered steps", () => {
    const wire = JSON.parse(JSON.stringify({ data: { run: runRow, steps: [stepRow] } }))
    const parsed = z
      .object({
        data: z.object({ run: workflowRunSchema, steps: z.array(workflowRunStepSchema) }),
      })
      .safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the run carries a populated error payload when present", () => {
    const failed = {
      ...runRow,
      status: "failed" as const,
      result: null,
      error: { message: "boom", code: "E_BOOM", stepName: "reserve-inventory" },
    }
    const wire = JSON.parse(JSON.stringify({ data: failed }))
    const parsed = z.object({ data: workflowRunSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})
