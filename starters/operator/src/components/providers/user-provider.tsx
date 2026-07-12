"use client"

import { createAdminUserBindings } from "@voyant-travel/admin-react"

import { adminAuthRuntime } from "@/lib/admin-auth-runtime"
import type { CurrentUser } from "@/lib/current-user"

export const { UserProvider, useUser } = createAdminUserBindings<CurrentUser>(
  adminAuthRuntime.getCurrentUser,
)
