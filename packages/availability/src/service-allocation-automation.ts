import { and, eq, type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  type AllocatorResource,
  type AllocatorTraveler,
  planRoomAllocation,
  planVehicleSeatAllocation,
} from "./auto-allocator.js"
import {
  type AllocationResource,
  allocationResources,
  availabilitySlots,
  productOptionResourceTemplates,
} from "./schema.js"
import {
  type AllocationMutationOptions,
  AllocationServiceError,
  getSlotAllocationManifest,
  recordAllocationAudit,
  type SlotAllocationManifest,
} from "./service-allocation.js"
import {
  type allocationAutomationSchema,
  type SeatLayoutCell,
  type SeatLayoutSpec,
  seatLayoutSpecSchema,
  type upsertResourceTemplateSchema,
} from "./validation.js"

/**
 * Emit `ARRAY[$1, $2, …]::text[]` so Postgres doesn't try to cast a
 * tuple to `text[]`. See `sqlTextArray` in service-allocation.ts and
 * issue #952.
 */
function sqlTextArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql.raw(", "),
  )}]::text[]`
}

export type UpsertResourceTemplateInput = z.infer<typeof upsertResourceTemplateSchema>
export type AllocationAutomationInput = z.infer<typeof allocationAutomationSchema>

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

export interface ResourceTemplate {
  id: string
  productOptionId: string
  kind: string
  refType: string | null
  refId: string | null
  capacity: number
  namePattern: string
  layout: string | null
  defaultCount: number | null
  flags: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ProductOptionResourceTemplates {
  id: string
  name: string
  code: string | null
  description: string | null
  status: string
  isDefault: boolean
  sortOrder: number
  templates: ResourceTemplate[]
}

export interface AllocationAutomationResult {
  kind: string
  assigned?: number
  skipped?: number
  created?: number
  resources?: AllocationResource[]
}

export async function listProductOptionResourceTemplates(
  db: PostgresJsDatabase,
  productId: string,
): Promise<ProductOptionResourceTemplates[]> {
  const optionRows = await executeRows<ProductOptionRow>(
    db,
    sql`
      SELECT id, name, code, description, status, is_default, sort_order
      FROM product_options
      WHERE product_id = ${productId}
      ORDER BY sort_order, created_at
    `,
  )

  if (optionRows.length === 0) return []

  const optionIds = optionRows.map((row) => row.id)
  const templateRows = await executeRows<ResourceTemplateRow>(
    db,
    sql`
      SELECT id, product_option_id, kind, ref_type, ref_id, capacity, name_pattern, layout, default_count, flags, created_at, updated_at
      FROM product_option_resource_templates
      WHERE product_option_id = ANY(${sqlTextArray(optionIds)})
      ORDER BY kind, created_at
    `,
  )

  const byOption = new Map<string, ResourceTemplate[]>()
  for (const row of templateRows) {
    const list = byOption.get(row.product_option_id) ?? []
    list.push(toResourceTemplate(row))
    byOption.set(row.product_option_id, list)
  }

  return optionRows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    templates: byOption.get(row.id) ?? [],
  }))
}

export async function upsertProductOptionResourceTemplate(
  db: PostgresJsDatabase,
  productId: string,
  productOptionId: string,
  kind: string,
  input: UpsertResourceTemplateInput,
): Promise<ResourceTemplate> {
  await assertProductOptionBelongsToProduct(db, productId, productOptionId)

  const [row] = await db
    .insert(productOptionResourceTemplates)
    .values({
      productOptionId,
      kind,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      capacity: input.capacity,
      namePattern: input.namePattern,
      layout: input.layout ?? null,
      defaultCount: input.defaultCount ?? null,
      flags: input.flags ?? {},
    })
    .onConflictDoUpdate({
      target: [productOptionResourceTemplates.productOptionId, productOptionResourceTemplates.kind],
      set: {
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        capacity: input.capacity,
        namePattern: input.namePattern,
        layout: input.layout ?? null,
        defaultCount: input.defaultCount ?? null,
        flags: input.flags ?? {},
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new AllocationServiceError("Resource template upsert failed", 500)
  return {
    id: row.id,
    productOptionId: row.productOptionId,
    kind: row.kind,
    refType: row.refType,
    refId: row.refId,
    capacity: row.capacity,
    namePattern: row.namePattern,
    layout: row.layout,
    defaultCount: row.defaultCount,
    flags: row.flags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function deleteProductOptionResourceTemplate(
  db: PostgresJsDatabase,
  productId: string,
  productOptionId: string,
  kind: string,
) {
  await assertProductOptionBelongsToProduct(db, productId, productOptionId)

  const [row] = await db
    .delete(productOptionResourceTemplates)
    .where(
      and(
        eq(productOptionResourceTemplates.productOptionId, productOptionId),
        eq(productOptionResourceTemplates.kind, kind),
      ),
    )
    .returning({ id: productOptionResourceTemplates.id })

  return row ? { productOptionId, kind } : null
}

async function assertProductOptionBelongsToProduct(
  db: PostgresJsDatabase,
  productId: string,
  productOptionId: string,
) {
  const [row] = await executeRows<{ id: string }>(
    db,
    sql`
      SELECT id
      FROM product_options
      WHERE id = ${productOptionId}
        AND product_id = ${productId}
      LIMIT 1
    `,
  )

  if (!row) throw new AllocationServiceError("Product option not found for product", 404)
}

export async function autoMaterializeAllocationResources(
  db: PostgresJsDatabase,
  slotId: string,
  input: AllocationAutomationInput,
  options: AllocationMutationOptions = {},
): Promise<AllocationAutomationResult> {
  const kind = input.kind ?? "room"
  const [slot] = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1)
  if (!slot) throw new AllocationServiceError("Availability slot not found", 404)

  const existing = await executeRows<{ count: number }>(
    db,
    sql`
      SELECT COUNT(*)::int AS count
      FROM allocation_resources
      WHERE slot_id = ${slotId} AND kind = ${kind}
    `,
  )
  if ((existing[0]?.count ?? 0) > 0) {
    throw new AllocationServiceError("Resources already exist", 409, {
      detail: "Delete existing resources before re-materializing, or add new ones manually.",
    })
  }

  const groups = await executeRows<AutoMaterializeRow>(
    db,
    sql`
      WITH slot_bookings AS (
        SELECT DISTINCT b.id AS booking_id
        FROM bookings b
        JOIN booking_allocations ba ON ba.booking_id = b.id
        WHERE ba.availability_slot_id = ${slotId}
          AND b.status IN ('draft', 'on_hold', 'confirmed', 'in_progress', 'completed')
          AND ba.status IN ('held', 'confirmed', 'fulfilled')
      ),
      -- Pax per option = sum of booking_item quantities for items belonging
      -- to bookings on this slot. The previous formulation joined
      -- booking_travelers to booking_id, which cross-multiplied items × travelers
      -- whenever a booking had more than one item (e.g. Adult + Senior rows
      -- on the same booking inflated pax_count to 4 instead of 2).
      pax AS (
        SELECT bi.option_id, SUM(bi.quantity)::int AS pax_count
        FROM booking_items bi
        JOIN slot_bookings sb ON sb.booking_id = bi.booking_id
        WHERE bi.option_id IS NOT NULL
        GROUP BY bi.option_id
      )
      SELECT
        pax.option_id,
        pax.pax_count,
        t.capacity,
        t.name_pattern,
        t.ref_type,
        t.ref_id,
        t.layout,
        t.flags,
        po.name AS option_name,
        po.sort_order
      FROM pax
      JOIN product_option_resource_templates t
        ON t.product_option_id = pax.option_id AND t.kind = ${kind}
      LEFT JOIN product_options po ON po.id = pax.option_id
      ORDER BY po.sort_order NULLS LAST, po.name NULLS LAST
    `,
  )

  if (groups.length === 0) return { kind, created: 0, resources: [] }

  const created: AllocationResource[] = []
  let sequence = 0
  for (const group of groups) {
    if (kind === "vehicle_seat") {
      const vehicleResources = await materializeVehicleSeatGroup(db, slotId, group, sequence)
      sequence += vehicleResources.vehicleCount
      created.push(...vehicleResources.resources)
      continue
    }

    const unitsNeeded = Math.max(1, Math.ceil(group.pax_count / Math.max(1, group.capacity)))
    for (let index = 0; index < unitsNeeded; index++) {
      sequence += 1
      // Default the resource's ref to its materializing option so the UI
      // can badge each row with the option name (e.g. Standard double).
      // Templates that explicitly set ref_type/ref_id (e.g. pointing at a
      // hotel inventory row) keep their own values.
      const resolvedRefType = group.ref_type ?? "option"
      const resolvedRefId = group.ref_id ?? group.option_id
      const [row] = await db
        .insert(allocationResources)
        .values({
          slotId,
          kind,
          refType: resolvedRefType,
          refId: resolvedRefId,
          label: renderNamePattern(group.name_pattern, {
            sequence: String(sequence),
            option: group.option_name ?? "",
            index: String(index + 1),
          }),
          capacity: group.capacity,
          flags: { ...(group.flags ?? {}), templateOptionId: group.option_id },
          sortOrder: sequence,
        })
        .returning()
      if (row) created.push(row)
    }
  }

  if (created.length > 0) {
    await recordAllocationAudit(db, {
      slotId,
      action: "resources.materialize",
      actorId: options.actorId ?? null,
      after: { kind, created: created.length },
    })
  }

  return { kind, created: created.length, resources: created }
}

export async function autoAllocateSlotResources(
  db: PostgresJsDatabase,
  slotId: string,
  input: AllocationAutomationInput,
  options: AllocationMutationOptions = {},
): Promise<AllocationAutomationResult> {
  const kind = input.kind ?? "room"
  const manifest = await getSlotAllocationManifest(db, slotId)
  if (!manifest) throw new AllocationServiceError("Availability slot not found", 404)

  const resources = manifest.resources.filter((resource) => resource.kind === kind)
  if (resources.length === 0) {
    throw new AllocationServiceError("No resources for this allocation kind", 400, { kind })
  }

  const travelers = toAllocatorTravelers(manifest, kind)
  const allocatorResources = resources.map(toAllocatorResource)
  const plan =
    kind === "vehicle_seat"
      ? planVehicleSeatAllocation(travelers, allocatorResources)
      : planRoomAllocation(travelers, allocatorResources)

  if (plan.assignments.length > 0) {
    const travelerIds = plan.assignments.map((assignment) => assignment.travelerId)
    const resourceIds = plan.assignments.map((assignment) => assignment.resourceId)
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM allocation_resources
        WHERE slot_id = ${slotId} AND kind = ${kind}
        FOR UPDATE
      `)
      await tx.execute(sql`
        INSERT INTO booking_traveler_travel_details (traveler_id, allocations)
        SELECT
          row.traveler_id,
          jsonb_build_object(${kind}::text, row.resource_id::text)
        FROM unnest(${sqlTextArray(travelerIds)}, ${sqlTextArray(resourceIds)}) AS row(traveler_id, resource_id)
        ON CONFLICT (traveler_id) DO UPDATE SET
          allocations =
            COALESCE(booking_traveler_travel_details.allocations, '{}'::jsonb)
            || EXCLUDED.allocations,
          updated_at = now()
      `)
    })
  }

  await recordAllocationAudit(db, {
    slotId,
    action: "auto-allocate",
    actorId: options.actorId ?? null,
    after: { kind, assigned: plan.assignments.length, skipped: plan.skipped },
  })

  return { kind, assigned: plan.assignments.length, skipped: plan.skipped }
}

export interface MaterializeSlotResourcesFromTemplatesOptions {
  /**
   * Restrict materialisation to a single template kind. When omitted,
   * all templates with a non-null `defaultCount` for the slot's option
   * are seeded.
   */
  kind?: string
  /**
   * Skip templates whose `kind` already has resources for the slot.
   * Defaults to true so the helper is safe to call repeatedly during
   * slot generation.
   */
  skipExisting?: boolean
}

/**
 * Auto-seed `allocation_resources` for a freshly-published slot from
 * its option's `product_option_resource_templates` rows that declare a
 * `default_count`. Distinct from `autoMaterializeAllocationResources`,
 * which derives counts from existing bookings. Templates without
 * `default_count` are skipped — operators handle those via the admin
 * materialise route once pax is known.
 *
 * Vehicle-seat layouts are out of scope here; use the existing
 * `autoMaterializeAllocationResources` path for those once the slot
 * has bookings (it knows pax-per-option).
 */
export async function materializeSlotResourcesFromTemplateDefaults(
  db: PostgresJsDatabase,
  slotId: string,
  opts: MaterializeSlotResourcesFromTemplatesOptions = {},
): Promise<{ created: number; resources: AllocationResource[] }> {
  const [slot] = await db
    .select({ id: availabilitySlots.id, optionId: availabilitySlots.optionId })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1)
  if (!slot?.optionId) return { created: 0, resources: [] }

  const templateConditions = [eq(productOptionResourceTemplates.productOptionId, slot.optionId)]
  if (opts.kind) {
    templateConditions.push(eq(productOptionResourceTemplates.kind, opts.kind))
  }

  const templates = await db
    .select()
    .from(productOptionResourceTemplates)
    .where(and(...templateConditions))
    .orderBy(productOptionResourceTemplates.kind, productOptionResourceTemplates.createdAt)

  if (templates.length === 0) return { created: 0, resources: [] }

  const skipExisting = opts.skipExisting !== false
  const existing = skipExisting
    ? await executeRows<{ kind: string }>(
        db,
        sql`SELECT DISTINCT kind FROM allocation_resources WHERE slot_id = ${slotId}`,
      )
    : []
  const existingKinds = new Set(existing.map((row) => row.kind))

  const resources: AllocationResource[] = []
  let sequence = 0

  for (const template of templates) {
    if (template.defaultCount == null || template.defaultCount <= 0) continue
    if (template.kind === "vehicle_seat") continue
    if (skipExisting && existingKinds.has(template.kind)) continue

    for (let index = 0; index < template.defaultCount; index++) {
      sequence += 1
      const [row] = await db
        .insert(allocationResources)
        .values({
          slotId,
          kind: template.kind,
          refType: template.refType,
          refId: template.refId,
          label: renderNamePattern(template.namePattern, {
            sequence: String(sequence),
            index: String(index + 1),
          }),
          capacity: template.capacity,
          flags: { ...(template.flags ?? {}), templateOptionId: template.productOptionId },
          sortOrder: sequence,
        })
        .returning()
      if (row) resources.push(row)
    }
  }

  return { created: resources.length, resources }
}

async function materializeVehicleSeatGroup(
  db: PostgresJsDatabase,
  slotId: string,
  group: AutoMaterializeRow,
  startingSequence: number,
): Promise<{ resources: AllocationResource[]; vehicleCount: number }> {
  const layoutSpec = parseLayoutSpecFromFlags(group.flags)
  if (layoutSpec) {
    return materializeVehicleSeatGroupFromSpec(db, slotId, group, startingSequence, layoutSpec)
  }

  const layout = group.layout ?? "2-2"
  const seatsPerRow = parseLayoutSeatsPerRow(layout)
  const vehiclesNeeded = Math.max(1, Math.ceil(group.pax_count / Math.max(1, group.capacity)))
  const resources: AllocationResource[] = []
  let sequence = startingSequence

  for (let vehicleIndex = 0; vehicleIndex < vehiclesNeeded; vehicleIndex++) {
    sequence += 1
    const [parent] = await db
      .insert(allocationResources)
      .values({
        slotId,
        kind: "vehicle",
        refType: group.ref_type,
        refId: group.ref_id,
        label: renderNamePattern(group.name_pattern || "Vehicle {sequence}", {
          sequence: String(sequence),
          option: group.option_name ?? "",
          index: String(vehicleIndex + 1),
        }),
        capacity: group.capacity,
        flags: { ...(group.flags ?? {}), layout, templateOptionId: group.option_id },
        sortOrder: sequence,
      })
      .returning()
    if (!parent) continue
    resources.push(parent)

    const seatsPerRowTotal = seatsPerRow.reduce((sum, seats) => sum + seats, 0)
    const totalRows = Math.ceil(group.capacity / seatsPerRowTotal)
    let seatIndex = 0
    for (let row = 1; row <= totalRows && seatIndex < group.capacity; row++) {
      let column = 0
      for (let groupIndex = 0; groupIndex < seatsPerRow.length; groupIndex++) {
        const blockSize = seatsPerRow[groupIndex] ?? 0
        for (let seatInGroup = 0; seatInGroup < blockSize; seatInGroup++) {
          if (seatIndex >= group.capacity) break
          column += 1
          const columnName = columnLetter(column)
          const position = seatPosition(groupIndex, seatInGroup, seatsPerRow)
          const [seat] = await db
            .insert(allocationResources)
            .values({
              slotId,
              kind: "vehicle_seat",
              refType: group.ref_type,
              refId: group.ref_id,
              label: renderNamePattern("Seat {row}{column}", {
                sequence: String(seatIndex + 1),
                row: String(row),
                column: columnName,
                seat: `${row}${columnName}`,
              }),
              capacity: 1,
              flags: { row, column: columnName, position },
              parentId: parent.id,
              sortOrder: seatIndex,
            })
            .returning()
          if (seat) resources.push(seat)
          seatIndex += 1
        }
      }
    }
  }

  return { resources, vehicleCount: vehiclesNeeded }
}

/**
 * Materialize using an explicit 2D layoutSpec. Each row's seat cells become
 * a vehicle_seat (skipping aisle/door/void). Window/aisle/middle is computed
 * from neighbouring cells, so a coach door in the middle row collapses to a
 * gap on the visual map (renderer side) without affecting seat numbering.
 */
async function materializeVehicleSeatGroupFromSpec(
  db: PostgresJsDatabase,
  slotId: string,
  group: AutoMaterializeRow,
  startingSequence: number,
  layoutSpec: SeatLayoutSpec,
): Promise<{ resources: AllocationResource[]; vehicleCount: number }> {
  const seatsPerVehicle = layoutSpec.rows.reduce(
    (sum, row) => sum + row.cells.filter((cell) => cell === "seat").length,
    0,
  )
  if (seatsPerVehicle === 0) return { resources: [], vehicleCount: 0 }

  const vehiclesNeeded = Math.max(1, Math.ceil(group.pax_count / seatsPerVehicle))
  const resources: AllocationResource[] = []
  let sequence = startingSequence

  for (let vehicleIndex = 0; vehicleIndex < vehiclesNeeded; vehicleIndex++) {
    sequence += 1
    const [parent] = await db
      .insert(allocationResources)
      .values({
        slotId,
        kind: "vehicle",
        refType: group.ref_type,
        refId: group.ref_id,
        label: renderNamePattern(group.name_pattern || "Vehicle {sequence}", {
          sequence: String(sequence),
          option: group.option_name ?? "",
          index: String(vehicleIndex + 1),
        }),
        capacity: seatsPerVehicle,
        flags: {
          ...(group.flags ?? {}),
          layoutSpec,
          templateOptionId: group.option_id,
        },
        sortOrder: sequence,
      })
      .returning()
    if (!parent) continue
    resources.push(parent)

    let seatIndex = 0
    for (let rowIndex = 0; rowIndex < layoutSpec.rows.length; rowIndex++) {
      const rowCells = layoutSpec.rows[rowIndex]?.cells ?? []
      const rowNumber = rowIndex + 1
      let column = 0
      for (let cellIndex = 0; cellIndex < rowCells.length; cellIndex++) {
        const cell = rowCells[cellIndex]
        if (cell !== "seat") continue
        column += 1
        const columnName = columnLetter(column)
        const position = positionFromCells(rowCells, cellIndex)
        const [seat] = await db
          .insert(allocationResources)
          .values({
            slotId,
            kind: "vehicle_seat",
            refType: group.ref_type,
            refId: group.ref_id,
            label: renderNamePattern("Seat {row}{column}", {
              sequence: String(seatIndex + 1),
              row: String(rowNumber),
              column: columnName,
              seat: `${rowNumber}${columnName}`,
            }),
            capacity: 1,
            flags: { row: rowNumber, column: columnName, position },
            parentId: parent.id,
            sortOrder: seatIndex,
          })
          .returning()
        if (seat) resources.push(seat)
        seatIndex += 1
      }
    }
  }

  return { resources, vehicleCount: vehiclesNeeded }
}

export function parseLayoutSpecFromFlags(
  flags: Record<string, unknown> | null,
): SeatLayoutSpec | null {
  const raw = flags?.layoutSpec
  if (!raw) return null
  const parsed = seatLayoutSpecSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * Derive window/aisle/middle from a seat's neighbours in the same row.
 *
 *   - Touching an aisle or door cell → "aisle" (the seat is on the aisle side)
 *   - Touching the row boundary or a void cell → "window"
 *   - Surrounded by other seats → "middle"
 *
 * Aisle takes precedence so the "window" tag is reserved for actual outer
 * seats; a 2-1 row's lone middle seat ends up "aisle" on both sides.
 */
export function positionFromCells(
  cells: ReadonlyArray<SeatLayoutCell>,
  index: number,
): "window" | "aisle" | "middle" {
  const prev = index > 0 ? cells[index - 1] : undefined
  const next = index < cells.length - 1 ? cells[index + 1] : undefined
  if (prev === "aisle" || prev === "door") return "aisle"
  if (next === "aisle" || next === "door") return "aisle"
  if (prev === undefined || prev === "void") return "window"
  if (next === undefined || next === "void") return "window"
  return "middle"
}

function toResourceTemplate(row: ResourceTemplateRow): ResourceTemplate {
  return {
    id: row.id,
    productOptionId: row.product_option_id,
    kind: row.kind,
    refType: row.ref_type,
    refId: row.ref_id,
    capacity: row.capacity,
    namePattern: row.name_pattern,
    layout: row.layout,
    defaultCount: row.default_count ?? null,
    flags: row.flags ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function toAllocatorTravelers(manifest: SlotAllocationManifest, kind: string): AllocatorTraveler[] {
  const travelers: AllocatorTraveler[] = []
  for (const booking of manifest.bookings) {
    for (const traveler of booking.travelers) {
      travelers.push({
        id: traveler.id,
        bookingId: booking.id,
        bookingStatus: booking.status,
        isLeadTraveler: traveler.isLeadTraveler,
        sharingGroupId: traveler.sharingGroupId,
        hasAccessibilityNeeds: traveler.hasAccessibilityNeeds,
        existingAllocationId: traveler.allocations[kind] ?? null,
      })
    }
  }
  return travelers
}

function toAllocatorResource(resource: AllocationResource): AllocatorResource {
  return {
    id: resource.id,
    kind: resource.kind,
    capacity: resource.capacity,
    flags: resource.flags ?? {},
    parentId: resource.parentId,
    row: typeof resource.flags?.row === "number" ? resource.flags.row : undefined,
    column: typeof resource.flags?.column === "string" ? resource.flags.column : undefined,
    position:
      resource.flags?.position === "window" ||
      resource.flags?.position === "aisle" ||
      resource.flags?.position === "middle"
        ? resource.flags.position
        : undefined,
  }
}

function parseLayoutSeatsPerRow(layout: string): number[] {
  const parts = layout
    .split("-")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part) && part > 0)
  return parts.length > 0 ? parts : [2, 2]
}

function columnLetter(value: number): string {
  let result = ""
  let n = value
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

function seatPosition(
  groupIndex: number,
  seatInGroup: number,
  groups: number[],
): "window" | "aisle" | "middle" {
  const isFirstGroup = groupIndex === 0
  const isLastGroup = groupIndex === groups.length - 1
  const blockSize = groups[groupIndex] ?? 0
  const isFirstSeat = seatInGroup === 0
  const isLastSeat = seatInGroup === blockSize - 1
  if (isFirstGroup && isFirstSeat) return "window"
  if (isLastGroup && isLastSeat) return "window"
  if ((isFirstGroup && isLastSeat) || (isLastGroup && isFirstSeat)) return "aisle"
  if (!isFirstGroup && !isLastGroup && (isFirstSeat || isLastSeat)) return "aisle"
  return "middle"
}

function renderNamePattern(pattern: string, vars: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
}

async function executeRows<T>(db: SqlExecutor, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  // node-postgres / neon-serverless drivers return `{ rows, rowCount, ... }`
  // instead of a bare array — unwrap so this wrapper is driver-agnostic.
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows
  }
  return []
}

interface ProductOptionRow {
  id: string
  name: string
  code: string | null
  description: string | null
  status: string
  is_default: boolean
  sort_order: number
}

interface ResourceTemplateRow {
  id: string
  product_option_id: string
  kind: string
  ref_type: string | null
  ref_id: string | null
  capacity: number
  name_pattern: string
  layout: string | null
  default_count: number | null
  flags: Record<string, unknown>
  created_at: string | Date
  updated_at: string | Date
}

interface AutoMaterializeRow {
  option_id: string
  pax_count: number
  capacity: number
  name_pattern: string
  ref_type: string | null
  ref_id: string | null
  layout: string | null
  flags: Record<string, unknown> | null
  option_name: string | null
  sort_order: number | null
}
