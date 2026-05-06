import { relations } from "drizzle-orm"

import { offerContactAssignments, orderContactAssignments } from "./schema-contacts.js"
import { offerItemParticipants, offerItems, offerParticipants, offers } from "./schema-offers.js"
import {
  orderItemParticipants,
  orderItems,
  orderParticipants,
  orders,
  orderTerms,
} from "./schema-orders.js"
import { offerStaffAssignments, orderStaffAssignments } from "./schema-staff.js"

export const offersRelations = relations(offers, ({ many }) => ({
  participants: many(offerParticipants),
  contactAssignments: many(offerContactAssignments),
  staffAssignments: many(offerStaffAssignments),
  items: many(offerItems),
  orders: many(orders),
  terms: many(orderTerms),
}))

export const offerParticipantsRelations = relations(offerParticipants, ({ one, many }) => ({
  offer: one(offers, { fields: [offerParticipants.offerId], references: [offers.id] }),
  itemLinks: many(offerItemParticipants),
}))

export const offerItemsRelations = relations(offerItems, ({ one, many }) => ({
  offer: one(offers, { fields: [offerItems.offerId], references: [offers.id] }),
  participants: many(offerItemParticipants),
  contactAssignments: many(offerContactAssignments),
  staffAssignments: many(offerStaffAssignments),
}))

export const offerItemParticipantsRelations = relations(offerItemParticipants, ({ one }) => ({
  offerItem: one(offerItems, {
    fields: [offerItemParticipants.offerItemId],
    references: [offerItems.id],
  }),
  participant: one(offerParticipants, {
    fields: [offerItemParticipants.travelerId],
    references: [offerParticipants.id],
  }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  offer: one(offers, { fields: [orders.offerId], references: [offers.id] }),
  participants: many(orderParticipants),
  contactAssignments: many(orderContactAssignments),
  staffAssignments: many(orderStaffAssignments),
  items: many(orderItems),
  terms: many(orderTerms),
}))

export const orderParticipantsRelations = relations(orderParticipants, ({ one, many }) => ({
  order: one(orders, { fields: [orderParticipants.orderId], references: [orders.id] }),
  itemLinks: many(orderItemParticipants),
}))

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  offerItem: one(offerItems, { fields: [orderItems.offerItemId], references: [offerItems.id] }),
  participants: many(orderItemParticipants),
  contactAssignments: many(orderContactAssignments),
  staffAssignments: many(orderStaffAssignments),
}))

export const orderItemParticipantsRelations = relations(orderItemParticipants, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemParticipants.orderItemId],
    references: [orderItems.id],
  }),
  participant: one(orderParticipants, {
    fields: [orderItemParticipants.travelerId],
    references: [orderParticipants.id],
  }),
}))

export const orderTermsRelations = relations(orderTerms, ({ one }) => ({
  offer: one(offers, { fields: [orderTerms.offerId], references: [offers.id] }),
  order: one(orders, { fields: [orderTerms.orderId], references: [orders.id] }),
}))

export const offerStaffAssignmentsRelations = relations(offerStaffAssignments, ({ one }) => ({
  offer: one(offers, { fields: [offerStaffAssignments.offerId], references: [offers.id] }),
  offerItem: one(offerItems, {
    fields: [offerStaffAssignments.offerItemId],
    references: [offerItems.id],
  }),
}))

export const offerContactAssignmentsRelations = relations(offerContactAssignments, ({ one }) => ({
  offer: one(offers, { fields: [offerContactAssignments.offerId], references: [offers.id] }),
  offerItem: one(offerItems, {
    fields: [offerContactAssignments.offerItemId],
    references: [offerItems.id],
  }),
}))

export const orderStaffAssignmentsRelations = relations(orderStaffAssignments, ({ one }) => ({
  order: one(orders, { fields: [orderStaffAssignments.orderId], references: [orders.id] }),
  orderItem: one(orderItems, {
    fields: [orderStaffAssignments.orderItemId],
    references: [orderItems.id],
  }),
}))

export const orderContactAssignmentsRelations = relations(orderContactAssignments, ({ one }) => ({
  order: one(orders, { fields: [orderContactAssignments.orderId], references: [orders.id] }),
  orderItem: one(orderItems, {
    fields: [orderContactAssignments.orderItemId],
    references: [orderItems.id],
  }),
}))
