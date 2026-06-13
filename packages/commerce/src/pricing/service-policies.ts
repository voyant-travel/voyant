import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { cancellationPolicies, cancellationPolicyRules } from "./schema.js"
import type {
  CancellationPolicyListQuery,
  CancellationPolicyRuleListQuery,
  CreateCancellationPolicyInput,
  CreateCancellationPolicyRuleInput,
  UpdateCancellationPolicyInput,
  UpdateCancellationPolicyRuleInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listCancellationPolicies(
  db: PostgresJsDatabase,
  query: CancellationPolicyListQuery,
) {
  const conditions = []
  if (query.policyType) conditions.push(eq(cancellationPolicies.policyType, query.policyType))
  if (query.active !== undefined) conditions.push(eq(cancellationPolicies.active, query.active))
  if (query.isDefault !== undefined) {
    conditions.push(eq(cancellationPolicies.isDefault, query.isDefault))
  }
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      or(ilike(cancellationPolicies.name, term), ilike(cancellationPolicies.code, term)),
    )
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(cancellationPolicies)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(cancellationPolicies.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(cancellationPolicies).where(where),
    query.limit,
    query.offset,
  )
}

export async function getCancellationPolicyById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(cancellationPolicies)
    .where(eq(cancellationPolicies.id, id))
    .limit(1)
  return row ?? null
}

export async function createCancellationPolicy(
  db: PostgresJsDatabase,
  data: CreateCancellationPolicyInput,
) {
  const [row] = await db.insert(cancellationPolicies).values(data).returning()
  return row ?? null
}

export async function updateCancellationPolicy(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateCancellationPolicyInput,
) {
  const [row] = await db
    .update(cancellationPolicies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cancellationPolicies.id, id))
    .returning()
  return row ?? null
}

export async function deleteCancellationPolicy(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(cancellationPolicies)
    .where(eq(cancellationPolicies.id, id))
    .returning({ id: cancellationPolicies.id })
  return row ?? null
}

export async function listCancellationPolicyRules(
  db: PostgresJsDatabase,
  query: CancellationPolicyRuleListQuery,
) {
  const conditions = []
  if (query.cancellationPolicyId) {
    conditions.push(eq(cancellationPolicyRules.cancellationPolicyId, query.cancellationPolicyId))
  }
  if (query.active !== undefined) conditions.push(eq(cancellationPolicyRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(cancellationPolicyRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(cancellationPolicyRules.sortOrder), asc(cancellationPolicyRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(cancellationPolicyRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getCancellationPolicyRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(cancellationPolicyRules)
    .where(eq(cancellationPolicyRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createCancellationPolicyRule(
  db: PostgresJsDatabase,
  data: CreateCancellationPolicyRuleInput,
) {
  const [row] = await db.insert(cancellationPolicyRules).values(data).returning()
  return row ?? null
}

export async function updateCancellationPolicyRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateCancellationPolicyRuleInput,
) {
  const [row] = await db
    .update(cancellationPolicyRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cancellationPolicyRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteCancellationPolicyRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(cancellationPolicyRules)
    .where(eq(cancellationPolicyRules.id, id))
    .returning({ id: cancellationPolicyRules.id })
  return row ?? null
}
