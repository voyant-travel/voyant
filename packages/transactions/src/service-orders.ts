import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  orderContactAssignments,
  orderItemParticipants,
  orderItems,
  orderParticipants,
  orderStaffAssignments,
  orders,
  orderTerms,
} from "./schema.js"
import type {
  CreateOrderContactAssignmentInput,
  CreateOrderInput,
  CreateOrderItemInput,
  CreateOrderItemTravelerInput,
  CreateOrderStaffAssignmentInput,
  CreateOrderTermInput,
  CreateOrderTravelerInput,
  OrderContactAssignmentListQuery,
  OrderItemListQuery,
  OrderItemTravelerListQuery,
  OrderListQuery,
  OrderStaffAssignmentListQuery,
  OrderTermListQuery,
  OrderTravelerListQuery,
  UpdateOrderContactAssignmentInput,
  UpdateOrderInput,
  UpdateOrderItemInput,
  UpdateOrderItemTravelerInput,
  UpdateOrderStaffAssignmentInput,
  UpdateOrderTermInput,
  UpdateOrderTravelerInput,
} from "./service-shared.js"
import {
  normalizeTimestamp,
  paginate,
  toOrderContactAssignmentResponse,
  toOrderItemTravelerResponse,
  toOrderStaffAssignmentResponse,
  toOrderTravelerResponse,
} from "./service-shared.js"

export async function listOrders(db: PostgresJsDatabase, query: OrderListQuery) {
  const conditions = []
  if (query.status) conditions.push(eq(orders.status, query.status))
  if (query.offerId) conditions.push(eq(orders.offerId, query.offerId))
  if (query.quoteId) conditions.push(eq(orders.quoteId, query.quoteId))
  if (query.quoteVersionId) conditions.push(eq(orders.quoteVersionId, query.quoteVersionId))
  if (query.personId) conditions.push(eq(orders.personId, query.personId))
  if (query.organizationId) conditions.push(eq(orders.organizationId, query.organizationId))
  if (query.marketId) conditions.push(eq(orders.marketId, query.marketId))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(orders.orderNumber, term), ilike(orders.title, term)))
  }
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orders)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(orders.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOrderById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return row ?? null
}

export async function createOrder(db: PostgresJsDatabase, data: CreateOrderInput) {
  const { orderedAt, confirmedAt, cancelledAt, expiresAt, ...rest } = data
  const [row] = await db
    .insert(orders)
    .values({
      ...rest,
      orderedAt: normalizeTimestamp(orderedAt),
      confirmedAt: normalizeTimestamp(confirmedAt),
      cancelledAt: normalizeTimestamp(cancelledAt),
      expiresAt: normalizeTimestamp(expiresAt),
    })
    .returning()
  return row ?? null
}

export async function updateOrder(db: PostgresJsDatabase, id: string, data: UpdateOrderInput) {
  const { orderedAt, confirmedAt, cancelledAt, expiresAt, ...rest } = data
  const [row] = await db
    .update(orders)
    .set({
      ...rest,
      orderedAt: normalizeTimestamp(orderedAt),
      confirmedAt: normalizeTimestamp(confirmedAt),
      cancelledAt: normalizeTimestamp(cancelledAt),
      expiresAt: normalizeTimestamp(expiresAt),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning()
  return row ?? null
}

export async function deleteOrder(db: PostgresJsDatabase, id: string) {
  const [row] = await db.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id })
  return row ?? null
}

export async function listOrderTravelers(db: PostgresJsDatabase, query: OrderTravelerListQuery) {
  const conditions = []
  if (query.orderId) conditions.push(eq(orderParticipants.orderId, query.orderId))
  if (query.personId) conditions.push(eq(orderParticipants.personId, query.personId))
  const where = conditions.length ? and(...conditions) : undefined
  const rows = db
    .select()
    .from(orderParticipants)
    .where(where)
    .limit(query.limit)
    .offset(query.offset)
    .orderBy(asc(orderParticipants.createdAt))
    .then((items) => items.map(toOrderTravelerResponse))
  return paginate(
    rows,
    db.select({ count: sql<number>`count(*)::int` }).from(orderParticipants).where(where),
    query.limit,
    query.offset,
  )
}
export const listOrderParticipants = listOrderTravelers

export async function getOrderTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(orderParticipants)
    .where(eq(orderParticipants.id, id))
    .limit(1)
  return row ? toOrderTravelerResponse(row) : null
}
export const getOrderParticipantById = getOrderTravelerById

export async function createOrderTraveler(db: PostgresJsDatabase, data: CreateOrderTravelerInput) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db.insert(orderParticipants).values(rest).returning()
  return row ? toOrderTravelerResponse(row) : null
}
export const createOrderParticipant = createOrderTraveler

export async function updateOrderTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderTravelerInput,
) {
  const { dateOfBirth, nationality, ...rest } = data
  void dateOfBirth
  void nationality
  const [row] = await db
    .update(orderParticipants)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(orderParticipants.id, id))
    .returning()
  return row ? toOrderTravelerResponse(row) : null
}
export const updateOrderParticipant = updateOrderTraveler

export async function deleteOrderTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderParticipants)
    .where(eq(orderParticipants.id, id))
    .returning({ id: orderParticipants.id })
  return row ?? null
}
export const deleteOrderParticipant = deleteOrderTraveler

export async function listOrderContactAssignments(
  db: PostgresJsDatabase,
  query: OrderContactAssignmentListQuery,
) {
  const conditions = []
  if (query.orderId) conditions.push(eq(orderContactAssignments.orderId, query.orderId))
  if (query.orderItemId) conditions.push(eq(orderContactAssignments.orderItemId, query.orderItemId))
  if (query.personId) conditions.push(eq(orderContactAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(orderContactAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orderContactAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(orderContactAssignments.createdAt))
      .then((items) => items.map(toOrderContactAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(orderContactAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOrderContactAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(orderContactAssignments)
    .where(eq(orderContactAssignments.id, id))
    .limit(1)
  return row ? toOrderContactAssignmentResponse(row) : null
}

export async function createOrderContactAssignment(
  db: PostgresJsDatabase,
  data: CreateOrderContactAssignmentInput,
) {
  const [row] = await db.insert(orderContactAssignments).values(data).returning()
  return row ? toOrderContactAssignmentResponse(row) : null
}

export async function updateOrderContactAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderContactAssignmentInput,
) {
  const [row] = await db
    .update(orderContactAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orderContactAssignments.id, id))
    .returning()
  return row ? toOrderContactAssignmentResponse(row) : null
}

export async function deleteOrderContactAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderContactAssignments)
    .where(eq(orderContactAssignments.id, id))
    .returning({ id: orderContactAssignments.id })
  return row ?? null
}

export async function listOrderStaffAssignments(
  db: PostgresJsDatabase,
  query: OrderStaffAssignmentListQuery,
) {
  const conditions = []
  if (query.orderId) conditions.push(eq(orderStaffAssignments.orderId, query.orderId))
  if (query.orderItemId) conditions.push(eq(orderStaffAssignments.orderItemId, query.orderItemId))
  if (query.personId) conditions.push(eq(orderStaffAssignments.personId, query.personId))
  if (query.role) conditions.push(eq(orderStaffAssignments.role, query.role))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orderStaffAssignments)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(orderStaffAssignments.createdAt))
      .then((items) => items.map(toOrderStaffAssignmentResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(orderStaffAssignments).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOrderStaffAssignmentById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(orderStaffAssignments)
    .where(eq(orderStaffAssignments.id, id))
    .limit(1)
  return row ? toOrderStaffAssignmentResponse(row) : null
}

export async function createOrderStaffAssignment(
  db: PostgresJsDatabase,
  data: CreateOrderStaffAssignmentInput,
) {
  const [row] = await db.insert(orderStaffAssignments).values(data).returning()
  return row ? toOrderStaffAssignmentResponse(row) : null
}

export async function updateOrderStaffAssignment(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderStaffAssignmentInput,
) {
  const [row] = await db
    .update(orderStaffAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orderStaffAssignments.id, id))
    .returning()
  return row ? toOrderStaffAssignmentResponse(row) : null
}

export async function deleteOrderStaffAssignment(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderStaffAssignments)
    .where(eq(orderStaffAssignments.id, id))
    .returning({ id: orderStaffAssignments.id })
  return row ?? null
}

export async function listOrderItems(db: PostgresJsDatabase, query: OrderItemListQuery) {
  const conditions = []
  if (query.orderId) conditions.push(eq(orderItems.orderId, query.orderId))
  if (query.offerItemId) conditions.push(eq(orderItems.offerItemId, query.offerItemId))
  if (query.productId) conditions.push(eq(orderItems.productId, query.productId))
  if (query.optionId) conditions.push(eq(orderItems.optionId, query.optionId))
  if (query.unitId) conditions.push(eq(orderItems.unitId, query.unitId))
  if (query.slotId) conditions.push(eq(orderItems.slotId, query.slotId))
  if (query.status) conditions.push(eq(orderItems.status, query.status))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orderItems)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(orderItems.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(orderItems).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOrderItemById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1)
  return row ?? null
}

export async function createOrderItem(db: PostgresJsDatabase, data: CreateOrderItemInput) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .insert(orderItems)
    .values({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
    })
    .returning()
  return row ?? null
}

export async function updateOrderItem(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderItemInput,
) {
  const { startsAt, endsAt, ...rest } = data
  const [row] = await db
    .update(orderItems)
    .set({
      ...rest,
      startsAt: normalizeTimestamp(startsAt),
      endsAt: normalizeTimestamp(endsAt),
      updatedAt: new Date(),
    })
    .where(eq(orderItems.id, id))
    .returning()
  return row ?? null
}

export async function deleteOrderItem(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderItems)
    .where(eq(orderItems.id, id))
    .returning({ id: orderItems.id })
  return row ?? null
}

export async function listOrderItemTravelers(
  db: PostgresJsDatabase,
  query: OrderItemTravelerListQuery,
) {
  const conditions = []
  if (query.orderItemId) conditions.push(eq(orderItemParticipants.orderItemId, query.orderItemId))
  if (query.travelerId) conditions.push(eq(orderItemParticipants.travelerId, query.travelerId))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orderItemParticipants)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(orderItemParticipants.createdAt))
      .then((items) => items.map(toOrderItemTravelerResponse)),
    db.select({ count: sql<number>`count(*)::int` }).from(orderItemParticipants).where(where),
    query.limit,
    query.offset,
  )
}
export const listOrderItemParticipants = listOrderItemTravelers

export async function getOrderItemTravelerById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(orderItemParticipants)
    .where(eq(orderItemParticipants.id, id))
    .limit(1)
  return row ? toOrderItemTravelerResponse(row) : null
}
export const getOrderItemParticipantById = getOrderItemTravelerById

export async function createOrderItemTraveler(
  db: PostgresJsDatabase,
  data: CreateOrderItemTravelerInput,
) {
  const [row] = await db.insert(orderItemParticipants).values(data).returning()
  return row ? toOrderItemTravelerResponse(row) : null
}
export const createOrderItemParticipant = createOrderItemTraveler

export async function updateOrderItemTraveler(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderItemTravelerInput,
) {
  const [row] = await db
    .update(orderItemParticipants)
    .set(data)
    .where(eq(orderItemParticipants.id, id))
    .returning()
  return row ? toOrderItemTravelerResponse(row) : null
}
export const updateOrderItemParticipant = updateOrderItemTraveler

export async function deleteOrderItemTraveler(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderItemParticipants)
    .where(eq(orderItemParticipants.id, id))
    .returning({ id: orderItemParticipants.id })
  return row ?? null
}
export const deleteOrderItemParticipant = deleteOrderItemTraveler

export async function listOrderTerms(db: PostgresJsDatabase, query: OrderTermListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(orderTerms.offerId, query.offerId))
  if (query.orderId) conditions.push(eq(orderTerms.orderId, query.orderId))
  if (query.termType) conditions.push(eq(orderTerms.termType, query.termType))
  if (query.acceptanceStatus)
    conditions.push(eq(orderTerms.acceptanceStatus, query.acceptanceStatus))
  const where = conditions.length ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(orderTerms)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(orderTerms.sortOrder), asc(orderTerms.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(orderTerms).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOrderTermById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(orderTerms).where(eq(orderTerms.id, id)).limit(1)
  return row ?? null
}

export async function createOrderTerm(db: PostgresJsDatabase, data: CreateOrderTermInput) {
  const { acceptedAt, ...rest } = data
  const [row] = await db
    .insert(orderTerms)
    .values({
      ...rest,
      acceptedAt: normalizeTimestamp(acceptedAt),
    })
    .returning()
  return row ?? null
}

export async function updateOrderTerm(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOrderTermInput,
) {
  const { acceptedAt, ...rest } = data
  const [row] = await db
    .update(orderTerms)
    .set({
      ...rest,
      acceptedAt: normalizeTimestamp(acceptedAt),
      updatedAt: new Date(),
    })
    .where(eq(orderTerms.id, id))
    .returning()
  return row ?? null
}

export async function deleteOrderTerm(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(orderTerms)
    .where(eq(orderTerms.id, id))
    .returning({ id: orderTerms.id })
  return row ?? null
}
