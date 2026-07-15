import type { VoyantDb } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"

import type {
  InitializeSetupInput,
  SetupState,
  SetupStepDefinition,
  SetupStepState,
} from "./contracts.js"
import {
  ORGANIZATION_SETUP_ID,
  type OrganizationSetup,
  type OrganizationSetupStep,
  organizationSetup,
  organizationSetupSteps,
} from "./schema.js"

export interface SetupStore {
  transaction<T>(run: (store: SetupStore) => Promise<T>): Promise<T>
  createOrganization(input: OrganizationSetup): Promise<boolean>
  getOrganization(): Promise<OrganizationSetup | null>
  ensureStep(stepId: string, firstSeenAt: Date): Promise<void>
  listSteps(): Promise<OrganizationSetupStep[]>
  markCompleted(stepId: string, at: Date): Promise<OrganizationSetupStep>
  markSkipped(stepId: string, at: Date): Promise<OrganizationSetupStep>
}

export interface InitializeSetupResult extends SetupState {
  shouldRedirect: boolean
}

export class SetupSelectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SetupSelectionError"
  }
}

export async function initializeSetup(
  store: SetupStore,
  input: InitializeSetupInput,
  selectedSteps: readonly SetupStepDefinition[],
  prefill: Readonly<Record<string, unknown>> = {},
  now = new Date(),
): Promise<InitializeSetupResult> {
  assertSelectedStepIds(input.stepIds, selectedSteps)
  return store.transaction(async (transaction) => {
    const created = await transaction.createOrganization({
      id: ORGANIZATION_SETUP_ID,
      startedAt: now,
      firstRunOpenedAt: input.fresh ? now : null,
    })
    for (const step of selectedSteps) await transaction.ensureStep(step.id, now)

    const organization = await transaction.getOrganization()
    if (!organization) throw new Error("Setup initialization did not persist organization state.")
    return {
      ...serializeState(organization, await transaction.listSteps(), selectedSteps, prefill),
      shouldRedirect: created && input.fresh,
    }
  })
}

export async function getSetupState(
  store: SetupStore,
  selectedSteps: readonly SetupStepDefinition[],
  prefill: Readonly<Record<string, unknown>> = {},
): Promise<SetupState | null> {
  const organization = await store.getOrganization()
  return organization
    ? serializeState(organization, await store.listSteps(), selectedSteps, prefill)
    : null
}

export async function completeSetupStep(
  store: SetupStore,
  selectedSteps: readonly SetupStepDefinition[],
  stepId: string,
  now = new Date(),
): Promise<SetupStepState> {
  requireSelectedStep(selectedSteps, stepId)
  return serializeStep(await store.markCompleted(stepId, now))
}

export async function skipSetupStep(
  store: SetupStore,
  selectedSteps: readonly SetupStepDefinition[],
  stepId: string,
  now = new Date(),
): Promise<SetupStepState> {
  const step = requireSelectedStep(selectedSteps, stepId)
  if (!step.skippable) {
    throw new SetupSelectionError(`Setup step "${stepId}" cannot be skipped.`)
  }
  return serializeStep(await store.markSkipped(stepId, now))
}

export function createDrizzleSetupStore(db: VoyantDb): SetupStore {
  return {
    async transaction(run) {
      return db.transaction((transaction) =>
        run(createDrizzleSetupStore(transaction as unknown as VoyantDb)),
      )
    },
    async createOrganization(input) {
      const rows = await db
        .insert(organizationSetup)
        .values(input)
        .onConflictDoNothing()
        .returning()
      return rows.length > 0
    },
    async getOrganization() {
      const [row] = await db
        .select()
        .from(organizationSetup)
        .where(eq(organizationSetup.id, ORGANIZATION_SETUP_ID))
        .limit(1)
      return row ?? null
    },
    async ensureStep(stepId, firstSeenAt) {
      await db.insert(organizationSetupSteps).values({ stepId, firstSeenAt }).onConflictDoNothing()
    },
    async listSteps() {
      return db.select().from(organizationSetupSteps).orderBy(organizationSetupSteps.firstSeenAt)
    },
    async markCompleted(stepId, at) {
      const [row] = await db
        .update(organizationSetupSteps)
        .set({ completedAt: at })
        .where(eq(organizationSetupSteps.stepId, stepId))
        .returning()
      if (!row) throw new Error(`Setup step "${stepId}" was not found.`)
      return row
    },
    async markSkipped(stepId, at) {
      const [row] = await db
        .update(organizationSetupSteps)
        .set({ skippedAt: at })
        .where(eq(organizationSetupSteps.stepId, stepId))
        .returning()
      if (!row) throw new Error(`Setup step "${stepId}" was not found.`)
      return row
    },
  }
}

function serializeState(
  organization: OrganizationSetup,
  steps: OrganizationSetupStep[],
  selectedSteps: readonly SetupStepDefinition[],
  prefill: Readonly<Record<string, unknown>>,
): SetupState {
  const stepById = new Map(steps.map((step) => [step.stepId, step]))
  return {
    startedAt: organization.startedAt.toISOString(),
    firstRunOpenedAt: organization.firstRunOpenedAt?.toISOString() ?? null,
    steps: selectedSteps.flatMap((selected) => {
      const step = stepById.get(selected.id)
      return step ? [serializeStep(step)] : []
    }),
    prefill: Object.fromEntries(
      selectedSteps.flatMap((step) =>
        Object.hasOwn(prefill, step.id) ? [[step.id, prefill[step.id]]] : [],
      ),
    ),
  }
}

function assertSelectedStepIds(
  requestedStepIds: readonly string[],
  selectedSteps: readonly SetupStepDefinition[],
): void {
  const requested = new Set(requestedStepIds)
  const selected = new Set(selectedSteps.map((step) => step.id))
  if (
    requested.size !== requestedStepIds.length ||
    requested.size !== selected.size ||
    [...requested].some((stepId) => !selected.has(stepId))
  ) {
    throw new SetupSelectionError(
      "Setup initialization step ids do not match the selected project graph.",
    )
  }
}

function requireSelectedStep(
  selectedSteps: readonly SetupStepDefinition[],
  stepId: string,
): SetupStepDefinition {
  const step = selectedSteps.find((candidate) => candidate.id === stepId)
  if (!step) {
    throw new SetupSelectionError(`Setup step "${stepId}" is not selected by the project graph.`)
  }
  return step
}

function serializeStep(step: OrganizationSetupStep): SetupStepState {
  return {
    stepId: step.stepId,
    firstSeenAt: step.firstSeenAt.toISOString(),
    completedAt: step.completedAt?.toISOString() ?? null,
    skippedAt: step.skippedAt?.toISOString() ?? null,
  }
}
