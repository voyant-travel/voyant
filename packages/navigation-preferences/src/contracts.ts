import { z } from "zod"

export const navigationVisibilityMapSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(200)
      .refine((id) => id === id.trim(), "Navigation IDs cannot have surrounding whitespace."),
    z.boolean(),
  )
  .superRefine((value, context) => {
    if (Object.keys(value).length > 1_000) {
      context.addIssue({
        code: "custom",
        message: "Navigation visibility maps may contain at most 1000 entries.",
      })
    }
  })

export const updateNavigationPreferencesSchema = z.object({
  visibility: navigationVisibilityMapSchema,
})

export const navigationPreferencesSnapshotSchema = z.object({
  organization: navigationVisibilityMapSchema,
  member: navigationVisibilityMapSchema,
  effective: navigationVisibilityMapSchema,
  canManageOrganization: z.boolean(),
})

export type NavigationVisibilityMap = Readonly<z.infer<typeof navigationVisibilityMapSchema>>

export interface NavigationPreferencesLayers {
  readonly organization: NavigationVisibilityMap
  readonly member: NavigationVisibilityMap
}

export interface ResolvedNavigationPreferences extends NavigationPreferencesLayers {
  readonly effective: NavigationVisibilityMap
}

export interface NavigationPreferencesSnapshot extends ResolvedNavigationPreferences {
  readonly canManageOrganization: boolean
}

export interface UpdateNavigationPreferencesInput {
  readonly visibility: NavigationVisibilityMap
}
