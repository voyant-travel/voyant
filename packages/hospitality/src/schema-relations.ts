import { bookingItems } from "@voyantjs/bookings/schema"
import { properties } from "@voyantjs/facilities/schema"
import { relations } from "drizzle-orm"

import {
  housekeepingTasks,
  maintenanceBlocks,
  roomBlocks,
  roomUnitStatusEvents,
  stayBookingItems,
  stayDailyRates,
} from "./schema-bookings.js"
import {
  mealPlans,
  ratePlanRoomTypes,
  ratePlans,
  roomTypeBedConfigs,
  roomTypes,
  roomUnits,
} from "./schema-inventory.js"
import {
  stayCheckpoints,
  stayFolioLines,
  stayFolios,
  stayOperations,
  stayServicePosts,
} from "./schema-operations.js"
import {
  ratePlanInventoryOverrides,
  roomInventory,
  roomTypeRates,
  stayRules,
} from "./schema-pricing.js"

export const roomTypesRelations = relations(roomTypes, ({ one, many }) => ({
  property: one(properties, { fields: [roomTypes.propertyId], references: [properties.id] }),
  bedConfigs: many(roomTypeBedConfigs),
  roomUnits: many(roomUnits),
  ratePlanRoomTypes: many(ratePlanRoomTypes),
  roomTypeRates: many(roomTypeRates),
  stayRules: many(stayRules),
  inventory: many(roomInventory),
  inventoryOverrides: many(ratePlanInventoryOverrides),
  stayBookingItems: many(stayBookingItems),
}))

export const roomTypeBedConfigsRelations = relations(roomTypeBedConfigs, ({ one }) => ({
  roomType: one(roomTypes, {
    fields: [roomTypeBedConfigs.roomTypeId],
    references: [roomTypes.id],
  }),
}))

export const roomUnitsRelations = relations(roomUnits, ({ one, many }) => ({
  property: one(properties, { fields: [roomUnits.propertyId], references: [properties.id] }),
  roomType: one(roomTypes, { fields: [roomUnits.roomTypeId], references: [roomTypes.id] }),
  stayBookingItems: many(stayBookingItems),
  roomBlocks: many(roomBlocks),
  statusEvents: many(roomUnitStatusEvents),
  maintenanceBlocks: many(maintenanceBlocks),
  housekeepingTasks: many(housekeepingTasks),
  stayOperations: many(stayOperations),
  stayCheckpoints: many(stayCheckpoints),
}))

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  property: one(properties, { fields: [mealPlans.propertyId], references: [properties.id] }),
  ratePlans: many(ratePlans),
  stayBookingItems: many(stayBookingItems),
}))

export const ratePlansRelations = relations(ratePlans, ({ one, many }) => ({
  property: one(properties, { fields: [ratePlans.propertyId], references: [properties.id] }),
  mealPlan: one(mealPlans, { fields: [ratePlans.mealPlanId], references: [mealPlans.id] }),
  roomTypes: many(ratePlanRoomTypes),
  roomTypeRates: many(roomTypeRates),
  stayRules: many(stayRules),
  inventoryOverrides: many(ratePlanInventoryOverrides),
  stayBookingItems: many(stayBookingItems),
}))

export const ratePlanRoomTypesRelations = relations(ratePlanRoomTypes, ({ one }) => ({
  ratePlan: one(ratePlans, {
    fields: [ratePlanRoomTypes.ratePlanId],
    references: [ratePlans.id],
  }),
  roomType: one(roomTypes, {
    fields: [ratePlanRoomTypes.roomTypeId],
    references: [roomTypes.id],
  }),
}))

export const stayRulesRelations = relations(stayRules, ({ one }) => ({
  property: one(properties, { fields: [stayRules.propertyId], references: [properties.id] }),
  ratePlan: one(ratePlans, { fields: [stayRules.ratePlanId], references: [ratePlans.id] }),
  roomType: one(roomTypes, { fields: [stayRules.roomTypeId], references: [roomTypes.id] }),
}))

export const roomInventoryRelations = relations(roomInventory, ({ one }) => ({
  property: one(properties, { fields: [roomInventory.propertyId], references: [properties.id] }),
  roomType: one(roomTypes, { fields: [roomInventory.roomTypeId], references: [roomTypes.id] }),
}))

export const ratePlanInventoryOverridesRelations = relations(
  ratePlanInventoryOverrides,
  ({ one }) => ({
    ratePlan: one(ratePlans, {
      fields: [ratePlanInventoryOverrides.ratePlanId],
      references: [ratePlans.id],
    }),
    roomType: one(roomTypes, {
      fields: [ratePlanInventoryOverrides.roomTypeId],
      references: [roomTypes.id],
    }),
  }),
)

export const roomTypeRatesRelations = relations(roomTypeRates, ({ one }) => ({
  ratePlan: one(ratePlans, {
    fields: [roomTypeRates.ratePlanId],
    references: [ratePlans.id],
  }),
  roomType: one(roomTypes, {
    fields: [roomTypeRates.roomTypeId],
    references: [roomTypes.id],
  }),
}))

export const stayBookingItemsRelations = relations(stayBookingItems, ({ one, many }) => ({
  bookingItem: one(bookingItems, {
    fields: [stayBookingItems.bookingItemId],
    references: [bookingItems.id],
  }),
  property: one(properties, {
    fields: [stayBookingItems.propertyId],
    references: [properties.id],
  }),
  roomType: one(roomTypes, { fields: [stayBookingItems.roomTypeId], references: [roomTypes.id] }),
  roomUnit: one(roomUnits, { fields: [stayBookingItems.roomUnitId], references: [roomUnits.id] }),
  ratePlan: one(ratePlans, { fields: [stayBookingItems.ratePlanId], references: [ratePlans.id] }),
  mealPlan: one(mealPlans, { fields: [stayBookingItems.mealPlanId], references: [mealPlans.id] }),
  dailyRates: many(stayDailyRates),
  housekeepingTasks: many(housekeepingTasks),
  operations: many(stayOperations),
}))

export const stayDailyRatesRelations = relations(stayDailyRates, ({ one }) => ({
  stayBookingItem: one(stayBookingItems, {
    fields: [stayDailyRates.stayBookingItemId],
    references: [stayBookingItems.id],
  }),
}))

export const roomBlocksRelations = relations(roomBlocks, ({ one }) => ({
  property: one(properties, { fields: [roomBlocks.propertyId], references: [properties.id] }),
  roomType: one(roomTypes, { fields: [roomBlocks.roomTypeId], references: [roomTypes.id] }),
  roomUnit: one(roomUnits, { fields: [roomBlocks.roomUnitId], references: [roomUnits.id] }),
}))

export const roomUnitStatusEventsRelations = relations(roomUnitStatusEvents, ({ one }) => ({
  roomUnit: one(roomUnits, {
    fields: [roomUnitStatusEvents.roomUnitId],
    references: [roomUnits.id],
  }),
}))

export const maintenanceBlocksRelations = relations(maintenanceBlocks, ({ one }) => ({
  property: one(properties, {
    fields: [maintenanceBlocks.propertyId],
    references: [properties.id],
  }),
  roomType: one(roomTypes, {
    fields: [maintenanceBlocks.roomTypeId],
    references: [roomTypes.id],
  }),
  roomUnit: one(roomUnits, {
    fields: [maintenanceBlocks.roomUnitId],
    references: [roomUnits.id],
  }),
}))

export const housekeepingTasksRelations = relations(housekeepingTasks, ({ one }) => ({
  property: one(properties, {
    fields: [housekeepingTasks.propertyId],
    references: [properties.id],
  }),
  roomUnit: one(roomUnits, {
    fields: [housekeepingTasks.roomUnitId],
    references: [roomUnits.id],
  }),
  stayBookingItem: one(stayBookingItems, {
    fields: [housekeepingTasks.stayBookingItemId],
    references: [stayBookingItems.id],
  }),
}))

export const stayOperationsRelations = relations(stayOperations, ({ one, many }) => ({
  stayBookingItem: one(stayBookingItems, {
    fields: [stayOperations.stayBookingItemId],
    references: [stayBookingItems.id],
  }),
  property: one(properties, {
    fields: [stayOperations.propertyId],
    references: [properties.id],
  }),
  roomUnit: one(roomUnits, { fields: [stayOperations.roomUnitId], references: [roomUnits.id] }),
  checkpoints: many(stayCheckpoints),
  servicePosts: many(stayServicePosts),
  folios: many(stayFolios),
}))

export const stayCheckpointsRelations = relations(stayCheckpoints, ({ one }) => ({
  stayOperation: one(stayOperations, {
    fields: [stayCheckpoints.stayOperationId],
    references: [stayOperations.id],
  }),
  roomUnit: one(roomUnits, { fields: [stayCheckpoints.roomUnitId], references: [roomUnits.id] }),
}))

export const stayServicePostsRelations = relations(stayServicePosts, ({ one, many }) => ({
  stayOperation: one(stayOperations, {
    fields: [stayServicePosts.stayOperationId],
    references: [stayOperations.id],
  }),
  bookingItem: one(bookingItems, {
    fields: [stayServicePosts.bookingItemId],
    references: [bookingItems.id],
  }),
  folioLines: many(stayFolioLines),
}))

export const stayFoliosRelations = relations(stayFolios, ({ one, many }) => ({
  stayOperation: one(stayOperations, {
    fields: [stayFolios.stayOperationId],
    references: [stayOperations.id],
  }),
  lines: many(stayFolioLines),
}))

export const stayFolioLinesRelations = relations(stayFolioLines, ({ one }) => ({
  stayFolio: one(stayFolios, {
    fields: [stayFolioLines.stayFolioId],
    references: [stayFolios.id],
  }),
  servicePost: one(stayServicePosts, {
    fields: [stayFolioLines.servicePostId],
    references: [stayServicePosts.id],
  }),
}))
