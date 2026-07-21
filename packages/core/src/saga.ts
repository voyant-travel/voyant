/**
 * Runtime context passed to each saga step's run and compensate functions.
 */
export interface SagaContext {
  /** Name of the saga currently executing. */
  sagaName: string
  /**
   * Accumulated results from prior steps, keyed by step name.
   * Later steps may read outputs produced by earlier steps.
   */
  results: Record<string, unknown>
}

/**
 * Run function for a step. Receives the saga input and context;
 * returns the step's output (which is stored in `ctx.results`).
 */
export type StepRunFn<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  ctx: SagaContext,
) => TOutput | Promise<TOutput>

/**
 * Compensation function for a step. Invoked in reverse order on
 * saga failure. Receives the step's own output (what `run` returned).
 */
export type StepCompensateFn<TOutput = unknown> = (
  output: TOutput,
  ctx: SagaContext,
) => void | Promise<void>

/**
 * Internal step definition accumulated by the {@link sagaStep} builder.
 */
export interface SagaStepDefinition {
  name: string
  runFn?: StepRunFn
  compensateFn?: StepCompensateFn
}

/**
 * Fluent builder for a saga step. Chain `.run()` and optionally `.compensate()`.
 */
export interface SagaStepBuilder<TInput = unknown, TOutput = unknown> {
  run(fn: StepRunFn<TInput, TOutput>): SagaStepBuilder<TInput, TOutput>
  /** Sets the step's compensation (rollback) function. */
  compensate(fn: StepCompensateFn<TOutput>): SagaStepBuilder<TInput, TOutput>
  /** Internal definition. Do not mutate. */
  readonly definition: SagaStepDefinition
}

/**
 * Create a step builder. Name must be unique within a saga.
 *
 * ```ts
 * sagaStep<MyInput, MyOutput>("reserve-inventory")
 *   .run(async (input, ctx) => {  ... })
 *   .compensate(async (output, ctx) => {  ... })
 * ```
 */
export function sagaStep<TInput = unknown, TOutput = unknown>(
  name: string,
): SagaStepBuilder<TInput, TOutput> {
  const def: SagaStepDefinition = { name }
  const builder: SagaStepBuilder<TInput, TOutput> = {
    run(fn) {
      def.runFn = fn as StepRunFn
      return builder
    },
    compensate(fn) {
      def.compensateFn = fn as StepCompensateFn
      return builder
    },
    definition: def,
  }
  return builder
}

/**
 * Options passed to {@link SagaDefinition.run}.
 */
export interface SagaRunOptions {
  /** Initial input passed to every step's run function. */
  input?: unknown
  /**
   * Pre-seeded `ctx.results` entries — used by resume runs to expose
   * prior step outputs (from a parent run) without re-executing the
   * step. Steps whose name appears in `seedResults` are skipped at
   * the executor level: their entry is copied into ctx.results and
   * `runFn` is not invoked. Compensation for skipped steps is also
   * suppressed (the parent run's output remains canonical).
   *
   * Pairs with {@link skipUntil} — typically you set both to the
   * same set so callers don't need to coordinate. When `skipUntil`
   * is set, every step before that name MUST appear in `seedResults`
   * so dependent steps see the values they expect.
   */
  seedResults?: Record<string, unknown>
  /**
   * Resume sentinel — when set, the executor skips steps until it
   * reaches this name (then runs normally from there onward). Steps
   * before the sentinel are still added to ctx.results from
   * {@link seedResults}. Throws if the named step doesn't exist in
   * the saga.
   */
  skipUntil?: string
}

/**
 * Result of a successful saga execution.
 */
export interface SagaResult {
  /** Step outputs keyed by step name. */
  results: Record<string, unknown>
}

/**
 * In-process domain saga returned by {@link createSaga}.
 */
export interface SagaDefinition {
  /** Saga name. */
  readonly name: string
  /** Ordered list of step builders. */
  readonly steps: ReadonlyArray<SagaStepBuilder>
  /** Execute the saga. Throws on failure after running compensations. */
  run(options?: SagaRunOptions): Promise<SagaResult>
}

/**
 * Thrown when a saga is misconfigured, for example when a run function is
 * missing or step names are duplicated.
 */
export class SagaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SagaError"
  }
}

/**
 * Create an in-process saga from a sequence of compensating steps.
 *
 * Semantics:
 * - Steps run sequentially in array order.
 * - Each step's output is stored in `ctx.results[stepName]`.
 * - If any step's run function throws, previously-completed steps'
 *   compensation functions run in reverse order, then the error re-throws.
 * - Compensation errors are caught and logged; they do not mask the
 *   original failure.
 * This is not a durable job runner: execution lives entirely within one
 * process. Use a job when work must survive process failure or run later.
 */
export function createSaga(name: string, steps: ReadonlyArray<SagaStepBuilder>): SagaDefinition {
  const seen = new Set<string>()
  for (const builder of steps) {
    const stepName = builder.definition.name
    if (seen.has(stepName)) {
      throw new SagaError(`Saga "${name}" has duplicate step name "${stepName}"`)
    }
    seen.add(stepName)
  }

  async function run(options: SagaRunOptions = {}): Promise<SagaResult> {
    const ctx: SagaContext = {
      sagaName: name,
      results: { ...(options.seedResults ?? {}) },
    }
    const input = options.input
    const completed: Array<{ def: SagaStepDefinition; output: unknown }> = []

    // Validate skipUntil up-front so callers get a clear error
    // before any steps run (vs a silent no-op if the name is wrong).
    if (options.skipUntil !== undefined) {
      const found = steps.some((b) => b.definition.name === options.skipUntil)
      if (!found) {
        throw new SagaError(`Saga "${name}" cannot resume: step "${options.skipUntil}" not found`)
      }
    }

    let skipping = options.skipUntil !== undefined

    try {
      for (const builder of steps) {
        const def = builder.definition
        if (skipping) {
          if (def.name === options.skipUntil) {
            skipping = false
          } else {
            // Step is skipped: keep its seeded result in ctx.results
            // (or null if none was seeded) and move on. Compensation
            // is suppressed for skipped steps — the parent run's
            // output is canonical, we shouldn't roll it back.
            continue
          }
        }
        if (!def.runFn) {
          throw new SagaError(`Saga "${name}" step "${def.name}" has no run function`)
        }
        const output = await def.runFn(input, ctx)
        ctx.results[def.name] = output
        completed.push({ def, output })
      }
      return { results: ctx.results }
    } catch (err) {
      for (let i = completed.length - 1; i >= 0; i--) {
        const entry = completed[i]
        if (!entry?.def.compensateFn) continue
        try {
          await entry.def.compensateFn(entry.output, ctx)
        } catch (compensationErr) {
          console.error(
            `[saga:${name}] compensation for step "${entry.def.name}" threw:`,
            compensationErr,
          )
        }
      }
      throw err
    }
  }

  return {
    name,
    steps,
    run,
  }
}
