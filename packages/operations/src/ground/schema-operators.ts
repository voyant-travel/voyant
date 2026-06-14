import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { groundVehicleCategoryEnum, groundVehicleClassEnum } from "./schema-shared.js"

export const groundOperators = pgTable(
  "ground_operators",
  {
    id: typeId("ground_operators"),
    supplierId: text("supplier_id"),
    facilityId: typeIdRef("facility_id"),
    name: text("name").notNull(),
    code: text("code"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ground_operators_name_created").on(table.name, table.createdAt),
    index("idx_ground_operators_supplier_name_created").on(
      table.supplierId,
      table.name,
      table.createdAt,
    ),
    index("idx_ground_operators_facility_name_created").on(
      table.facilityId,
      table.name,
      table.createdAt,
    ),
    index("idx_ground_operators_active_name_created").on(table.active, table.name, table.createdAt),
  ],
)

export const groundVehicles = pgTable(
  "ground_vehicles",
  {
    id: typeId("ground_vehicles"),
    resourceId: text("resource_id").notNull(),
    operatorId: typeIdRef("operator_id").references(() => groundOperators.id, {
      onDelete: "set null",
    }),
    category: groundVehicleCategoryEnum("category").notNull().default("other"),
    vehicleClass: groundVehicleClassEnum("vehicle_class").notNull().default("standard"),
    passengerCapacity: integer("passenger_capacity"),
    checkedBagCapacity: integer("checked_bag_capacity"),
    carryOnCapacity: integer("carry_on_capacity"),
    wheelchairCapacity: integer("wheelchair_capacity"),
    childSeatCapacity: integer("child_seat_capacity"),
    isAccessible: boolean("is_accessible").notNull().default(false),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_ground_vehicles_resource").on(table.resourceId),
    index("idx_ground_vehicles_created").on(table.createdAt),
    index("idx_ground_vehicles_operator_created").on(table.operatorId, table.createdAt),
    index("idx_ground_vehicles_category_created").on(table.category, table.createdAt),
    index("idx_ground_vehicles_active_created").on(table.active, table.createdAt),
  ],
)

export const groundDrivers = pgTable(
  "ground_drivers",
  {
    id: typeId("ground_drivers"),
    resourceId: text("resource_id").notNull(),
    operatorId: typeIdRef("operator_id").references(() => groundOperators.id, {
      onDelete: "set null",
    }),
    licenseNumber: text("license_number"),
    spokenLanguages: jsonb("spoken_languages").$type<string[]>().notNull().default([]),
    isGuide: boolean("is_guide").notNull().default(false),
    isMeetAndGreetCapable: boolean("is_meet_and_greet_capable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_ground_drivers_resource").on(table.resourceId),
    index("idx_ground_drivers_created").on(table.createdAt),
    index("idx_ground_drivers_operator_created").on(table.operatorId, table.createdAt),
    index("idx_ground_drivers_active_created").on(table.active, table.createdAt),
  ],
)

export type GroundOperator = typeof groundOperators.$inferSelect
export type NewGroundOperator = typeof groundOperators.$inferInsert
export type GroundVehicle = typeof groundVehicles.$inferSelect
export type NewGroundVehicle = typeof groundVehicles.$inferInsert
export type GroundDriver = typeof groundDrivers.$inferSelect
export type NewGroundDriver = typeof groundDrivers.$inferInsert
