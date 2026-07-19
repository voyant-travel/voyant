import type { PublicBookingOwner } from "@voyant-travel/bookings"
import type { CustomerBuyerContext } from "@voyant-travel/hono"
import { organizations, people } from "@voyant-travel/relationships"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/** Revalidates the canonical CRM buyer immediately before checkout ownership is accepted. */
export async function resolveActiveCustomerBookingOwner(
  db: PostgresJsDatabase,
  buyer: CustomerBuyerContext,
): Promise<PublicBookingOwner | null> {
  if (buyer.kind === "personal") {
    if (!buyer.relationshipPersonId) return null
    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.id, buyer.relationshipPersonId),
          eq(people.status, "active"),
          isNull(people.archivedAt),
        ),
      )
      .limit(1)
    return person ? { kind: "personal", personId: person.id } : null
  }

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        eq(organizations.id, buyer.relationshipOrganizationId),
        eq(organizations.status, "active"),
        isNull(organizations.archivedAt),
      ),
    )
    .limit(1)
  return organization ? { kind: "business", organizationId: organization.id } : null
}
