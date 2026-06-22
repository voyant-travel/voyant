import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM")

export const createSpaceBlockSchema = z.object({
  functionSpaceId: z.string().min(1),
  name: z.string().min(1),
  programId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  currency: z.string().optional(),
  netRateCents: z.number().int().min(0).optional(),
  sellRateCents: z.number().int().min(0).optional(),
  holdStartTime: hhmm.optional(),
  holdEndTime: hhmm.optional(),
  optionDate: isoDate.optional(),
  cutoffDate: isoDate.optional(),
  notes: z.string().optional(),
})

export const setSpaceBlockSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        date: isoDate,
        unitsHeld: z.number().int().min(0),
        netRateCentsOverride: z.number().int().min(0).optional(),
        sellRateCentsOverride: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
})

export const spaceBlockPickupSchema = z.object({
  bookingId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  startDate: isoDate,
  endDate: isoDate,
  units: z.number().int().min(1).default(1),
})

export const reverseSpaceBlockPickupSchema = z
  .object({
    pickupId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
  })
  .refine((v) => v.pickupId || v.sessionId, {
    message: "one of pickupId or sessionId is required",
  })

export type CreateSpaceBlockBody = z.infer<typeof createSpaceBlockSchema>
export type SetSpaceBlockSlotsBody = z.infer<typeof setSpaceBlockSlotsSchema>
export type SpaceBlockPickupBody = z.infer<typeof spaceBlockPickupSchema>
export type ReverseSpaceBlockPickupBody = z.infer<typeof reverseSpaceBlockPickupSchema>
