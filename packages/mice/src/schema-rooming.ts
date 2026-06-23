import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { programs } from "./schema.js"
import { programDelegates } from "./schema-delegates.js"

/**
 * First-class rooming manifest (§9-Q3) — program-centric, replacing the
 * fragmented roomTypeId + sharingGroupId + allocations-JSONB on booking
 * traveler details. A shared room is one assignment with MANY delegates via the
 * explicit join (§9-Q5). See RFC voyant#1489 (Phase 3).
 */
export const roomingAssignments = pgTable(
  "mice_rooming_assignments",
  {
    id: typeId("mice_rooming_assignments"),
    // Intra-package FK:
    programId: typeIdRef("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    // Cross-package → loose columns + defineLink at the deployment:
    roomBlockId: typeIdRef("room_block_id"), // → accommodations.roomBlocks
    roomTypeId: typeIdRef("room_type_id"), // → accommodations.roomTypes
    bedConfig: text("bed_config"),
    sharingGroupId: text("sharing_group_id"),
    checkIn: date("check_in"),
    checkOut: date("check_out"),
    specialRequests: text("special_requests"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_rooming_assignments_program").on(table.programId),
    index("idx_mice_rooming_assignments_room_block").on(table.roomBlockId),
  ],
)

export const roomingAssignmentDelegates = pgTable(
  "mice_rooming_assignment_delegates",
  {
    id: typeId("mice_rooming_assignment_delegates"),
    roomingAssignmentId: typeIdRef("rooming_assignment_id")
      .notNull()
      .references(() => roomingAssignments.id, { onDelete: "cascade" }),
    delegateId: typeIdRef("delegate_id")
      .notNull()
      .references(() => programDelegates.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    bedLabel: text("bed_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mice_rooming_assignment_delegates_assignment").on(table.roomingAssignmentId),
    // A delegate appears at most once per rooming assignment.
    uniqueIndex("uidx_mice_rooming_assignment_delegates_pair").on(
      table.roomingAssignmentId,
      table.delegateId,
    ),
  ],
)

export type RoomingAssignment = typeof roomingAssignments.$inferSelect
export type NewRoomingAssignment = typeof roomingAssignments.$inferInsert
export type RoomingAssignmentDelegate = typeof roomingAssignmentDelegates.$inferSelect
export type NewRoomingAssignmentDelegate = typeof roomingAssignmentDelegates.$inferInsert
