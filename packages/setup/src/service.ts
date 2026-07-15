import type { VoyantDb } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"

import type { InitializeSetupInput, SetupState, SetupStepState } from "./contracts.js"
import {
  ORGANIZATION_SETUP_ID,
  type OrganizationSetup,
  type OrganizationSetupStep,
  organizationSetup,
  organizationSetupSteps,
} from "./schema.js"

export interface SetupStore {
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

export async function initializeSetup(
  store: SetupStore,
  input: InitializeSetupInput,
  prefill: Readonly<Record<string, unknown>> = {},
  now = new Date(),
): Promise<InitializeSetupResult> {
  const created = await store.createOrganization({
    id: ORGANIZATION_SETUP_ID,
    startedAt: now,
    firstRunOpenedAt: input.fresh ? now : null,
  })
  for (const stepId of new Set(input.stepIds)) await store.ensureStep(stepId, now)

  const organization = await store.getOrganization()
  if (!organization) throw new Error("Setup initialization did not persist organization state.")
  return {
    ...serializeState(organization, await store.listSteps(), prefill),
    shouldRedirect: created && input.fresh,
  }
}

export async function getSetupState(
  store: SetupStore,
  prefill: Readonly<Record<string, unknown>> = {},
): Promise<SetupState | null> {
  const organization = await store.getOrganization()
  return organization ? serializeState(organization, await store.listSteps(), prefill) : null
}

export async function completeSetupStep(
  store: SetupStore,
  stepId: string,
  now = new Date(),
): Promise<SetupStepState> {
  await store.ensureStep(stepId, now)
  return serializeStep(await store.markCompleted(stepId, now))
}

export async function skipSetupStep(
  store: SetupStore,
  stepId: string,
  now = new Date(),
): Promise<SetupStepState> {
  await store.ensureStep(stepId, now)
  return serializeStep(await store.markSkipped(stepId, now))
}

export function createDrizzleSetupStore(db: VoyantDb): SetupStore {
  return {
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
  prefill: Readonly<Record<string, unknown>>,
): SetupState {
  return {
    startedAt: organization.startedAt.toISOString(),
    firstRunOpenedAt: organization.firstRunOpenedAt?.toISOString() ?? null,
    steps: steps.map(serializeStep),
    prefill: { ...prefill },
  }
}

function serializeStep(step: OrganizationSetupStep): SetupStepState {
  return {
    stepId: step.stepId,
    firstSeenAt: step.firstSeenAt.toISOString(),
    completedAt: step.completedAt?.toISOString() ?? null,
    skippedAt: step.skippedAt?.toISOString() ?? null,
  }
}
