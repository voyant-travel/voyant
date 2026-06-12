import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { allocationResources, availabilitySlots } from "./schema.js"
import type {
  AllocationMutationOptions,
  CreateAllocationResourceInput,
  UpdateAllocationResourceInput,
} from "./service-allocation.js"
import { recordAllocationAudit } from "./service-allocation-audit.js"
import { AllocationServiceError } from "./service-allocation-errors.js"
import {
  clearTravelerAllocationsForResource,
  countResourceOccupants,
} from "./service-allocation-resource-capacity.js"

export async function createAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  input: CreateAllocationResourceInput,
  options: AllocationMutationOptions = {},
) {
  const [slot] = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1)
  if (!slot) return null

  const [row] = await db
    .insert(allocationResources)
    .values({
      slotId,
      kind: input.kind,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      label: input.label ?? null,
      capacity: input.capacity,
      flags: input.flags ?? {},
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
  if (row) {
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.create",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      after: {
        kind: row.kind,
        label: row.label,
        capacity: row.capacity,
      },
    })
  }
  return row ?? null
}

export async function updateAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
  input: UpdateAllocationResourceInput,
  options: AllocationMutationOptions = {},
) {
  const [existing] = await db
    .select({
      id: allocationResources.id,
      kind: allocationResources.kind,
      label: allocationResources.label,
      capacity: allocationResources.capacity,
      flags: allocationResources.flags,
      sortOrder: allocationResources.sortOrder,
    })
    .from(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .limit(1)
  if (!existing) return null

  if (input.capacity !== undefined) {
    const current = await countResourceOccupants(db, slotId, existing.kind, resourceId)
    if (current > input.capacity) {
      throw new AllocationServiceError("Resource over capacity", 409, {
        capacity: input.capacity,
        current,
      })
    }
  }

  const patch = {
    ...input,
    updatedAt: new Date(),
  }

  const [row] = await db
    .update(allocationResources)
    .set(patch)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .returning()
  if (row) {
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.update",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      before: {
        label: existing.label,
        capacity: existing.capacity,
        flags: existing.flags,
        sortOrder: existing.sortOrder,
      },
      after: {
        label: row.label,
        capacity: row.capacity,
        flags: row.flags,
        sortOrder: row.sortOrder,
      },
    })
  }
  return row ?? null
}

export async function deleteAllocationResource(
  db: PostgresJsDatabase,
  slotId: string,
  resourceId: string,
  options: AllocationMutationOptions = {},
) {
  const [row] = await db
    .delete(allocationResources)
    .where(and(eq(allocationResources.id, resourceId), eq(allocationResources.slotId, slotId)))
    .returning({
      id: allocationResources.id,
      kind: allocationResources.kind,
      label: allocationResources.label,
      capacity: allocationResources.capacity,
    })
  if (row) {
    await clearTravelerAllocationsForResource(db, resourceId)
    await recordAllocationAudit(db, {
      slotId,
      action: "resource.delete",
      actorId: options.actorId ?? null,
      resourceId: row.id,
      before: {
        kind: row.kind,
        label: row.label,
        capacity: row.capacity,
      },
    })
  }
  return row ?? null
}
