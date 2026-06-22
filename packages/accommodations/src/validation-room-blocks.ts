import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const createRoomBlockSchema = z.object({
  roomTypeId: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().min(1),
  programId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  propertyId: z.string().min(1).optional(),
  netRateCents: z.number().int().min(0).optional(),
  sellRateCents: z.number().int().min(0).optional(),
  optionDate: isoDate.optional(),
  cutoffDate: isoDate.optional(),
  notes: z.string().optional(),
})

export const setRoomBlockNightsSchema = z.object({
  nights: z
    .array(
      z.object({
        date: isoDate,
        roomsHeld: z.number().int().min(0),
        netRateCentsOverride: z.number().int().min(0).optional(),
        sellRateCentsOverride: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
})

export const roomBlockPickupSchema = z.object({
  bookingId: z.string().min(1).optional(),
  stayBookingItemId: z.string().min(1).optional(),
  checkIn: isoDate,
  checkOut: isoDate,
  rooms: z.number().int().min(1).default(1),
})

export const reverseRoomBlockPickupSchema = z
  .object({
    pickupId: z.string().min(1).optional(),
    stayBookingItemId: z.string().min(1).optional(),
  })
  .refine((v) => v.pickupId || v.stayBookingItemId, {
    message: "one of pickupId or stayBookingItemId is required",
  })

export type CreateRoomBlockBody = z.infer<typeof createRoomBlockSchema>
export type SetRoomBlockNightsBody = z.infer<typeof setRoomBlockNightsSchema>
export type RoomBlockPickupBody = z.infer<typeof roomBlockPickupSchema>
export type ReverseRoomBlockPickupBody = z.infer<typeof reverseRoomBlockPickupSchema>
