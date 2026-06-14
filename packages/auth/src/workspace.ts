import type { getDb } from "@voyant-travel/db"
import { authUser, userProfilesTable } from "@voyant-travel/db/schema/iam"
import { eq, sql } from "drizzle-orm"

type WorkspaceDb = ReturnType<typeof getDb>

export type CurrentUser = {
  id: string
  email: string | null
  phoneNumber?: string | null
  firstName: string | null
  lastName: string | null
  locale: string
  timezone: string | null
  isSuperAdmin: boolean
  isSupportUser: boolean
  createdAt: string
  profilePictureUrl?: string | null
}

export type UpdateCurrentUserProfileInput = {
  userId: string
  firstName?: string | null
  lastName?: string | null
  locale?: string | null
  timezone?: string | null
  profilePictureUrl?: string | null
}

export type ProvisionCurrentUserProfileInput = {
  userId: string
  name?: string | null
  image?: string | null
  isSuperAdmin?: boolean
}

export type AuthStatus = {
  userExists: boolean
  authenticated: boolean
  reason?: string
}

export async function getCurrentUser(
  db: WorkspaceDb,
  input: { userId: string },
): Promise<CurrentUser | null> {
  const [row] = await db
    .select({
      id: authUser.id,
      email: authUser.email,
      phoneNumber: authUser.phoneNumber,
      createdAt: authUser.createdAt,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      locale: userProfilesTable.locale,
      timezone: userProfilesTable.timezone,
      avatarUrl: userProfilesTable.avatarUrl,
      isSuperAdmin: userProfilesTable.isSuperAdmin,
      isSupportUser: userProfilesTable.isSupportUser,
    })
    .from(authUser)
    .leftJoin(userProfilesTable, eq(userProfilesTable.id, authUser.id))
    .where(eq(authUser.id, input.userId))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    locale: row.locale ?? "en",
    timezone: row.timezone ?? null,
    isSuperAdmin: row.isSuperAdmin ?? false,
    isSupportUser: row.isSupportUser ?? false,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    profilePictureUrl: row.avatarUrl ?? null,
  }
}

export async function updateCurrentUserProfile(
  db: WorkspaceDb,
  input: UpdateCurrentUserProfileInput,
): Promise<CurrentUser | null> {
  const values = {
    id: input.userId,
    ...profilePatchValues(input),
    updatedAt: sql`now()`,
  }

  await db
    .insert(userProfilesTable)
    .values(values)
    .onConflictDoUpdate({
      target: userProfilesTable.id,
      set: {
        ...profilePatchValues(input),
        updatedAt: sql`now()`,
      },
    })

  return getCurrentUser(db, { userId: input.userId })
}

export async function isFirstAuthUser(db: WorkspaceDb): Promise<boolean> {
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
  return (countRow?.count ?? 0) === 1
}

export async function provisionCurrentUserProfile(
  db: WorkspaceDb,
  input: ProvisionCurrentUserProfileInput,
): Promise<void> {
  const { firstName, lastName } = splitDisplayName(input.name)
  const values: typeof userProfilesTable.$inferInsert = {
    id: input.userId,
    firstName,
    lastName,
    avatarUrl: input.image ?? null,
  }

  if (input.isSuperAdmin !== undefined) {
    values.isSuperAdmin = input.isSuperAdmin
  }

  await db.insert(userProfilesTable).values(values).onConflictDoNothing()
}

export async function ensureCurrentUserProfile(
  db: WorkspaceDb,
  userId: string,
): Promise<AuthStatus> {
  try {
    const [existingProfile] = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, userId))
      .limit(1)

    if (existingProfile) {
      return { userExists: true, authenticated: true }
    }

    const [user] = await db
      .select({
        name: authUser.name,
        email: authUser.email,
        phoneNumber: authUser.phoneNumber,
        image: authUser.image,
      })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1)

    // Phone-only signups have `email` null but `phoneNumber` set; the
    // schema check constraint guarantees at least one of the two.
    if (!user?.email && !user?.phoneNumber) {
      return {
        userExists: false,
        authenticated: true,
        reason: `No email or phone number found for user ${userId}.`,
      }
    }

    await provisionCurrentUserProfile(db, {
      userId,
      name: user.name,
      image: user.image,
    })

    return { userExists: true, authenticated: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      userExists: false,
      authenticated: true,
      reason: `Provisioning error: ${message}`,
    }
  }
}

function profilePatchValues(input: UpdateCurrentUserProfileInput) {
  const values: Partial<typeof userProfilesTable.$inferInsert> = {}

  if ("firstName" in input) values.firstName = normalizeOptionalText(input.firstName)
  if ("lastName" in input) values.lastName = normalizeOptionalText(input.lastName)
  if ("locale" in input) values.locale = input.locale ?? "en"
  if ("timezone" in input) values.timezone = normalizeOptionalText(input.timezone)
  if ("profilePictureUrl" in input)
    values.avatarUrl = normalizeOptionalText(input.profilePictureUrl)

  return values
}

function splitDisplayName(name: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  const nameParts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  const firstName = nameParts[0] ?? null
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null

  return { firstName, lastName }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
