import type { getDb } from "@voyantjs/db"
import { authUser, userProfilesTable } from "@voyantjs/db/schema/iam"
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

    const nameParts = user.name?.split(" ") ?? []
    const firstName = nameParts[0] ?? null
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null

    await db
      .insert(userProfilesTable)
      .values({ id: userId, firstName, lastName, avatarUrl: user.image ?? null })
      .onConflictDoNothing()

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
  const values: {
    firstName?: string | null
    lastName?: string | null
    locale?: string
    timezone?: string | null
  } = {}

  if ("firstName" in input) values.firstName = input.firstName ?? null
  if ("lastName" in input) values.lastName = input.lastName ?? null
  if ("locale" in input && input.locale !== null) values.locale = input.locale
  if ("timezone" in input) values.timezone = input.timezone ?? null

  return values
}
