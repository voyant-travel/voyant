import { z } from "zod"

export const navigationVisibilityMapSchema = z
  .record(z.string().trim().min(1).max(200), z.boolean())
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

export type NavigationVisibilityMap = z.infer<typeof navigationVisibilityMapSchema>
export type UpdateNavigationPreferencesInput = z.infer<typeof updateNavigationPreferencesSchema>

export type NavigationPreferencesSnapshot = z.infer<typeof navigationPreferencesSnapshotSchema>
