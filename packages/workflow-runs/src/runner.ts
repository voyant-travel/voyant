/**
 * Workflow runner registry — the missing piece that makes "click to
 * rerun" work in the dashboard. Saga workflows defined in
 * `@voyant-travel/core/workflows` are pure logic; running one needs
 * closures over `db`, `eventBus`, and per-bundle services. The
 * recorded `workflow_runs.input` row only captures the workflow
 * payload, not those closures.
 *
 * Bundles that own a workflow register a `WorkflowRunner` on
 * bootstrap. The rerun/resume routes look the runner up by name and
 * call `rerun(input, ctx)` / `resume(input, ctx)`.
 *
 * Idempotency declaration:
 *   - "safe"        — workflow is idempotent on the same input.
 *                     Fresh rerun runs without confirmation.
 *   - "unsafe"      — workflow has side effects that re-fire on rerun
 *                     (writes a new invoice, charges again, etc.).
 *                     The dashboard requires `confirm: true` in the
 *                     request body and a confirm dialog in the UI.
 *   - "resume-only" — fresh rerun is rejected; only the resume path
 *                     (skip past completed steps) is allowed.
 */

export type WorkflowIdempotency = "safe" | "unsafe" | "resume-only"

export interface WorkflowRerunContext {
  /** The original run's id — written to the new run's `parentRunId`. */
  parentRunId: string
  /** User who clicked "Rerun" / "Resume" in the dashboard. */
  triggeredByUserId: string | null
  /** The original run's correlationId — copied to the rerun. */
  correlationId: string | null
  /** The original run's tags — copied (rerun routes augment with `rerun:true` etc.). */
  tags: ReadonlyArray<string>
}

export interface WorkflowResumeContext extends WorkflowRerunContext {
  /**
   * Step name from which to resume. Outputs of all earlier completed
   * steps are passed in `seedResults`; the executor must skip those
   * steps and start at this one.
   */
  resumeFromStep: string
  /**
   * Outputs of completed steps from the parent run, keyed by step
   * name. The runner is expected to feed these into the workflow's
   * ctx.results so subsequent steps see prior outputs unchanged.
   */
  seedResults: Record<string, unknown>
}

export interface WorkflowTriggerContext {
  /** User or API key actor that triggered the workflow, when available. */
  triggeredByUserId: string | null
  /** Optional correlation id supplied by the caller. */
  correlationId: string | null
  /** Tags supplied by the caller for observability and filtering. */
  tags: ReadonlyArray<string>
  /** Optional caller-supplied idempotency key forwarded to the runner. */
  idempotencyKey: string | null
}

export interface WorkflowRunner {
  /** Workflow name — must match `workflow_runs.workflow_name`. */
  name: string
  /**
   * Idempotency declaration. Drives the dashboard's confirmation
   * behavior and the rerun route's `confirm: true` requirement.
   */
  idempotency: WorkflowIdempotency
  /** Human-friendly label shown in the rerun confirm dialog. */
  description?: string
  /**
   * Trigger the workflow by name from an admin/internal route. Runners that
   * expose this method are intentionally triggerable; missing methods keep
   * rerun/resume-only workflows closed to arbitrary dispatch.
   */
  trigger?(input: unknown, ctx: WorkflowTriggerContext): Promise<{ runId: string }>
  /**
   * Run the workflow fresh with the recorded input. Returns the new
   * run's id (the recorder's `runId`).
   *
   * Throws if `idempotency === "resume-only"`.
   */
  rerun(input: unknown, ctx: WorkflowRerunContext): Promise<{ runId: string }>
  /**
   * Resume from `ctx.resumeFromStep`. Steps before that name are
   * skipped (with their outputs hydrated from `ctx.seedResults`); the
   * resume step and everything after it run normally.
   *
   * Returns the new run's id.
   */
  resume(input: unknown, ctx: WorkflowResumeContext): Promise<{ runId: string }>
  /**
   * Optional per-input safety predicate. When supplied, the rerun
   * route calls it with the recorded input and the previous run; a
   * `false` result blocks the rerun (e.g. "don't re-issue an invoice
   * if one already exists for this booking"). Implementations
   * typically return a reason string for the user.
   */
  canRerun?: (input: unknown) => Promise<{ ok: true } | { ok: false; reason: string }>
}

let activeWorkflowRunnerRegistry: WorkflowRunnerRegistry | undefined

/**
 * Compatibility registration service for direct/manual composition. The
 * graph-selected runtime reads the concrete registry through its runtime port.
 */
export const workflowRunnerRegistryService = {
  register(runner: WorkflowRunner): void {
    if (!activeWorkflowRunnerRegistry) {
      throw new Error("WorkflowRunnerRegistry: no process registry has been bound")
    }
    activeWorkflowRunnerRegistry.register(runner)
  },
}

/**
 * Process-wide registry. Graph composition creates one through the package
 * contributor; direct applications may still instantiate and mount one.
 */
export class WorkflowRunnerRegistry {
  private readonly runners = new Map<string, WorkflowRunner>()

  constructor() {
    activeWorkflowRunnerRegistry = this
  }

  register(runner: WorkflowRunner): void {
    if (this.runners.has(runner.name)) {
      throw new Error(`WorkflowRunnerRegistry: runner "${runner.name}" already registered`)
    }
    this.runners.set(runner.name, runner)
  }

  // fallow-ignore-next-line unused-class-member
  get(name: string): WorkflowRunner | null {
    return this.runners.get(name) ?? null
  }

  // fallow-ignore-next-line unused-class-member
  has(name: string): boolean {
    return this.runners.has(name)
  }

  // fallow-ignore-next-line unused-class-member
  list(): ReadonlyArray<WorkflowRunner> {
    return Array.from(this.runners.values())
  }
}
