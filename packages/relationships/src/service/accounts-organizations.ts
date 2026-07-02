import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { organizations, people } from "../schema.js"
import type {
  CreateOrganizationInput,
  OrganizationListQuery,
  UpdateOrganizationInput,
} from "./accounts-shared.js"
import { paginate } from "./helpers.js"

export const organizationAccountsService = {
  async listOrganizations(db: PostgresJsDatabase, query: OrganizationListQuery) {
    const conditions = []

    if (query.ownerId) conditions.push(eq(organizations.ownerId, query.ownerId))
    if (query.relation) conditions.push(eq(organizations.relation, query.relation))
    if (query.status) conditions.push(eq(organizations.status, query.status))
    if (query.taxId) conditions.push(eq(organizations.taxId, query.taxId))
    // Exact tax-id lookup is used for de-duplication; do not let a stale or
    // fuzzy name search hide the matching organization.
    if (query.search && !query.taxId) {
      const term = `%${query.search}%`
      conditions.push(
        or(
          ilike(organizations.name, term),
          ilike(organizations.legalName, term),
          ilike(organizations.website, term),
        ),
      )
    }

    const where = conditions.length ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "name":
          return organizations.name
        case "industry":
          return organizations.industry
        case "relation":
          return organizations.relation
        case "status":
          return organizations.status
        case "createdAt":
          return organizations.createdAt
        default:
          return organizations.updatedAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    return paginate(
      db
        .select()
        .from(organizations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(organizations.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(organizations).where(where),
      query.limit,
      query.offset,
    )
  },

  async getOrganizationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
    return row ?? null
  },

  async createOrganization(db: PostgresJsDatabase, data: CreateOrganizationInput) {
    const [row] = await db.insert(organizations).values(data).returning()
    return row
  },

  async updateOrganization(db: PostgresJsDatabase, id: string, data: UpdateOrganizationInput) {
    const updates = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    )
    const [row] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning()
    return row ?? null
  },

  async deleteOrganization(db: PostgresJsDatabase, id: string) {
    return db.transaction(async (tx) => {
      const [organization] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, id))
        .for("update")
        .limit(1)

      if (!organization) return null

      const [{ count: linkedPeopleCount } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(people)
        .where(eq(people.organizationId, id))

      if (linkedPeopleCount > 0) {
        return { conflict: "linked_people" as const, linkedPeopleCount }
      }

      const [row] = await tx
        .delete(organizations)
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id })
      return row ?? null
    })
  },
}
