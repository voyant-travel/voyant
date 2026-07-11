import type { VoyantGraphJsonValue } from "@voyant-travel/core/project"

import {
  canonicalJson,
  type ResolvedVoyantDeploymentGraph,
  type ResolvedVoyantGraphUnit,
  type VoyantGraphDiagnostic,
} from "./deployment-graph.js"

export type VoyantGraphLifecycleOperation = "upgrade" | "uninstall"

export interface VoyantGraphLifecycleStep {
  id: string
  idempotencyKey: string
  kind: "migrate-graph" | "detach-unit" | "release-resource" | "activate-unit"
  unitId?: string
  resourceId?: string
  fromGraphHash: string
  toGraphHash: string
  reversible: boolean
}

export interface VoyantGraphLifecyclePlan {
  schemaVersion: "voyant.graph-lifecycle-plan.v1"
  operationId: string
  operation: VoyantGraphLifecycleOperation
  fromGraphHash: string
  toGraphHash: string
  steps: readonly VoyantGraphLifecycleStep[]
}

export interface CreateVoyantGraphLifecyclePlanInput {
  operationId: string
  operation: VoyantGraphLifecycleOperation
  previous: ResolvedVoyantDeploymentGraph
  next: ResolvedVoyantDeploymentGraph
}

export interface VoyantGraphLifecycleStepState {
  stepId: string
  status: "completed" | "rolled-back"
  rollbackToken?: VoyantGraphJsonValue
}

export interface VoyantGraphLifecycleExecutionState {
  schemaVersion: "voyant.graph-lifecycle-state.v1"
  operationId: string
  planFingerprint: string
  attempt: number
  status: "running" | "rolling-back" | "completed" | "rolled-back"
  steps: readonly VoyantGraphLifecycleStepState[]
  error?: string
}

export interface VoyantGraphLifecycleStateStore {
  load(operationId: string): Promise<VoyantGraphLifecycleExecutionState | undefined>
  save(state: VoyantGraphLifecycleExecutionState): Promise<void>
}

export interface VoyantGraphLifecycleExecutor {
  execute(
    step: VoyantGraphLifecycleStep,
    context: { operationId: string; attempt: number },
  ): Promise<{ rollbackToken?: VoyantGraphJsonValue } | undefined>
  rollback(
    step: VoyantGraphLifecycleStep,
    context: { operationId: string; attempt: number; rollbackToken?: VoyantGraphJsonValue },
  ): Promise<void>
}

export class VoyantGraphLifecyclePlanError extends Error {
  readonly diagnostics: readonly VoyantGraphDiagnostic[]

  constructor(diagnostics: readonly VoyantGraphDiagnostic[]) {
    super(
      `Cannot lower graph lifecycle plan with ${diagnostics.length} incompatible event contract(s)`,
    )
    this.name = "VoyantGraphLifecyclePlanError"
    this.diagnostics = diagnostics
  }
}

export function createVoyantGraphLifecyclePlan(
  input: CreateVoyantGraphLifecyclePlanInput,
): VoyantGraphLifecyclePlan {
  requireText(input.operationId, "operationId")
  if (input.previous.contentHash === input.next.contentHash) {
    return plan(input, [])
  }
  if (input.operation === "upgrade") {
    const diagnostics = validateVoyantGraphEventCompatibility(input.previous, input.next)
    if (diagnostics.length > 0) throw new VoyantGraphLifecyclePlanError(diagnostics)
  }

  const previous = unitsById(input.previous)
  const next = unitsById(input.next)
  const removedOrChanged = [...previous.values()]
    .filter((unit) => !sameUnit(unit, next.get(unit.id)))
    .sort(compareUnits)
  const addedOrChanged = [...next.values()]
    .filter((unit) => !sameUnit(unit, previous.get(unit.id)))
    .sort(compareUnits)

  if (input.operation === "uninstall" && addedOrChanged.length > 0) {
    throw new Error("Uninstall lifecycle plans cannot add or change graph units")
  }

  const steps: VoyantGraphLifecycleStep[] = []
  if (input.operation === "upgrade") {
    steps.push(step(input, "migrate-graph", "graph", false))
  }
  for (const unit of removedOrChanged) {
    steps.push(step(input, "detach-unit", unit.id, true, { unitId: unit.id }))
  }
  for (const unit of removedOrChanged) {
    for (const cleanup of unit.lifecycle?.cleanup ?? []) {
      if (!cleanup.on.includes(input.operation)) continue
      steps.push(
        step(input, "release-resource", `${unit.id}:${cleanup.resourceId}`, true, {
          unitId: unit.id,
          resourceId: cleanup.resourceId,
        }),
      )
    }
  }
  for (const unit of addedOrChanged) {
    steps.push(step(input, "activate-unit", unit.id, true, { unitId: unit.id }))
  }
  return plan(input, steps)
}

export async function executeVoyantGraphLifecyclePlan(
  plan: VoyantGraphLifecyclePlan,
  store: VoyantGraphLifecycleStateStore,
  executor: VoyantGraphLifecycleExecutor,
): Promise<VoyantGraphLifecycleExecutionState> {
  const fingerprint = canonicalJson(plan)
  const stored = await store.load(plan.operationId)
  if (stored?.planFingerprint !== undefined && stored.planFingerprint !== fingerprint) {
    throw new Error(
      `Lifecycle operation ${plan.operationId} was already started with a different plan`,
    )
  }
  if (stored?.status === "completed") return stored

  let state: VoyantGraphLifecycleExecutionState = stored
    ? { ...stored, attempt: stored.attempt + 1, error: undefined }
    : {
        schemaVersion: "voyant.graph-lifecycle-state.v1",
        operationId: plan.operationId,
        planFingerprint: fingerprint,
        attempt: 1,
        status: "running",
        steps: [],
      }

  if (state.status === "rolling-back") {
    return rollback(plan, state, store, executor)
  }
  if (state.status === "rolled-back") state = { ...state, status: "running", steps: [] }
  await store.save(state)

  try {
    for (const lifecycleStep of plan.steps) {
      if (
        state.steps.some(
          (entry) => entry.stepId === lifecycleStep.id && entry.status === "completed",
        )
      ) {
        continue
      }
      const result = await executor.execute(lifecycleStep, {
        operationId: plan.operationId,
        attempt: state.attempt,
      })
      state = {
        ...state,
        steps: [
          ...state.steps,
          {
            stepId: lifecycleStep.id,
            status: "completed",
            ...(result?.rollbackToken !== undefined ? { rollbackToken: result.rollbackToken } : {}),
          },
        ],
      }
      await store.save(state)
    }
    state = { ...state, status: "completed" }
    await store.save(state)
    return state
  } catch (error) {
    state = { ...state, status: "rolling-back", error: errorMessage(error) }
    await store.save(state)
    return rollback(plan, state, store, executor)
  }
}

export function validateVoyantGraphEventCompatibility(
  previous: ResolvedVoyantDeploymentGraph,
  next: ResolvedVoyantDeploymentGraph,
): VoyantGraphDiagnostic[] {
  const diagnostics: VoyantGraphDiagnostic[] = []
  const oldEvents = new Map(
    allUnits(previous).flatMap((unit) => unit.events.map((event) => [event.id, event])),
  )
  const nextEventIds = new Set(
    allUnits(next).flatMap((unit) => unit.events.map((event) => event.id)),
  )
  for (const unit of allUnits(previous)) {
    for (const event of unit.events) {
      if (event.version && event.payloadSchema && !nextEventIds.has(event.id)) {
        diagnostics.push(
          eventCompatibilityDiagnostic(unit, event, "the versioned event contract was removed"),
        )
      }
    }
  }
  for (const unit of allUnits(next)) {
    for (const event of unit.events) {
      const oldEvent = oldEvents.get(event.id)
      if (!oldEvent?.version || !oldEvent.payloadSchema) continue
      if (!event.version || !event.payloadSchema) {
        diagnostics.push(
          eventCompatibilityDiagnostic(unit, event, "the versioned payload contract was removed"),
        )
        continue
      }
      const oldVersion = semverParts(oldEvent.version)
      const newVersion = semverParts(event.version)
      if (!oldVersion || !newVersion) continue
      if (compareSemver(newVersion, oldVersion) < 0) {
        diagnostics.push(
          eventCompatibilityDiagnostic(
            unit,
            event,
            `version ${event.version} is older than ${oldEvent.version}`,
          ),
        )
        continue
      }
      if (newVersion[0] !== oldVersion[0]) continue
      for (const issue of incompatibleSchemaChanges(oldEvent.payloadSchema, event.payloadSchema)) {
        diagnostics.push(eventCompatibilityDiagnostic(unit, event, issue))
      }
    }
  }
  return diagnostics
}

async function rollback(
  plan: VoyantGraphLifecyclePlan,
  initial: VoyantGraphLifecycleExecutionState,
  store: VoyantGraphLifecycleStateStore,
  executor: VoyantGraphLifecycleExecutor,
): Promise<VoyantGraphLifecycleExecutionState> {
  let state = initial
  const steps = new Map(plan.steps.map((entry) => [entry.id, entry]))
  for (const completed of [...state.steps].reverse()) {
    if (completed.status === "rolled-back") continue
    const lifecycleStep = steps.get(completed.stepId)
    if (!lifecycleStep?.reversible) continue
    await executor.rollback(lifecycleStep, {
      operationId: plan.operationId,
      attempt: state.attempt,
      ...(completed.rollbackToken !== undefined ? { rollbackToken: completed.rollbackToken } : {}),
    })
    state = {
      ...state,
      steps: state.steps.map((entry) =>
        entry.stepId === completed.stepId ? { ...entry, status: "rolled-back" } : entry,
      ),
    }
    await store.save(state)
  }
  state = { ...state, status: "rolled-back" }
  await store.save(state)
  return state
}

function incompatibleSchemaChanges(
  previous: Record<string, VoyantGraphJsonValue>,
  next: Record<string, VoyantGraphJsonValue>,
  path = "$",
): string[] {
  const issues: string[] = []
  const previousTypes = schemaTypes(previous.type)
  const nextTypes = schemaTypes(next.type)
  if (previousTypes.some((type) => !nextTypes.includes(type))) {
    issues.push(`${path} narrows type ${previousTypes.join("|")} to ${nextTypes.join("|")}`)
  }
  const previousEnum = stringValues(previous.enum)
  const nextEnum = stringValues(next.enum)
  if (previousEnum.some((value) => !nextEnum.includes(value)))
    issues.push(`${path} removes enum values`)

  const oldProperties = recordValue(previous.properties)
  const newProperties = recordValue(next.properties)
  const oldRequired = new Set(stringValues(previous.required))
  const newRequired = new Set(stringValues(next.required))
  for (const [name, schema] of Object.entries(oldProperties)) {
    const replacement = newProperties[name]
    if (replacement === undefined) {
      issues.push(`${path}.${name} was removed`)
      continue
    }
    if (isJsonObject(schema) && isJsonObject(replacement)) {
      issues.push(...incompatibleSchemaChanges(schema, replacement, `${path}.${name}`))
    }
  }
  for (const name of newRequired) {
    if (!oldRequired.has(name)) issues.push(`${path}.${name} became required`)
  }
  return issues
}

function plan(
  input: CreateVoyantGraphLifecyclePlanInput,
  steps: VoyantGraphLifecycleStep[],
): VoyantGraphLifecyclePlan {
  return {
    schemaVersion: "voyant.graph-lifecycle-plan.v1",
    operationId: input.operationId,
    operation: input.operation,
    fromGraphHash: input.previous.contentHash,
    toGraphHash: input.next.contentHash,
    steps,
  }
}

function step(
  input: CreateVoyantGraphLifecyclePlanInput,
  kind: VoyantGraphLifecycleStep["kind"],
  identity: string,
  reversible: boolean,
  extra: Pick<VoyantGraphLifecycleStep, "unitId" | "resourceId"> = {},
): VoyantGraphLifecycleStep {
  const id = `${kind}:${identity}`
  return {
    id,
    idempotencyKey: `${input.operationId}:${id}`,
    kind,
    fromGraphHash: input.previous.contentHash,
    toGraphHash: input.next.contentHash,
    reversible,
    ...extra,
  }
}

function unitsById(graph: ResolvedVoyantDeploymentGraph): Map<string, ResolvedVoyantGraphUnit> {
  return new Map(allUnits(graph).map((unit) => [unit.id, unit]))
}

function allUnits(graph: ResolvedVoyantDeploymentGraph): ResolvedVoyantGraphUnit[] {
  return [...graph.modules, ...graph.extensions, ...graph.plugins]
}

function sameUnit(
  left: ResolvedVoyantGraphUnit,
  right: ResolvedVoyantGraphUnit | undefined,
): boolean {
  if (!right) return false
  const { order: _leftOrder, ...leftContract } = left
  const { order: _rightOrder, ...rightContract } = right
  return canonicalJson(leftContract) === canonicalJson(rightContract)
}

function compareUnits(left: ResolvedVoyantGraphUnit, right: ResolvedVoyantGraphUnit): number {
  return left.order - right.order || left.id.localeCompare(right.id)
}

function eventCompatibilityDiagnostic(
  unit: ResolvedVoyantGraphUnit,
  event: ResolvedVoyantGraphUnit["events"][number],
  issue: string,
): VoyantGraphDiagnostic {
  return {
    code: "VOYANT_GRAPH_INCOMPATIBLE_EVENT_SCHEMA",
    severity: "error",
    source: unit.id,
    facet: event.id,
    message: `Event ${event.eventType ?? event.id} ${event.version ?? "(unversioned)"} is not backward compatible: ${issue}`,
    hint: "Preserve the existing payload shape or publish the breaking contract under a new major version.",
  }
}

function semverParts(value: string): readonly [number, number, number] | undefined {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

function compareSemver(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

function schemaTypes(value: VoyantGraphJsonValue | undefined): string[] {
  if (typeof value === "string") return [value]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function stringValues(value: VoyantGraphJsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function recordValue(
  value: VoyantGraphJsonValue | undefined,
): Record<string, VoyantGraphJsonValue> {
  return isJsonObject(value) ? value : {}
}

function isJsonObject(
  value: VoyantGraphJsonValue | undefined,
): value is Record<string, VoyantGraphJsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must be a non-empty string`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
