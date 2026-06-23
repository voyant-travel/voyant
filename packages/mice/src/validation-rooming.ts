import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const createRoomingAssignmentSchema = z.object({
  programId: z.string().min(1),
  roomBlockId: z.string().min(1).optional(),
  roomTypeId: z.string().min(1).optional(),
  bedConfig: z.string().optional(),
  sharingGroupId: z.string().optional(),
  checkIn: isoDate.optional(),
  checkOut: isoDate.optional(),
  specialRequests: z.string().optional(),
})

export const updateRoomingAssignmentSchema = createRoomingAssignmentSchema
  .partial()
  .omit({ programId: true })

export const roomingListQuerySchema = z.object({
  programId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const setRoomingDelegatesSchema = z.object({
  // Full replace of occupants; an empty array clears the room.
  delegates: z.array(
    z.object({
      delegateId: z.string().min(1),
      isPrimary: z.boolean().optional(),
      bedLabel: z.string().optional(),
    }),
  ),
})

export type CreateRoomingAssignmentBody = z.infer<typeof createRoomingAssignmentSchema>
export type UpdateRoomingAssignmentBody = z.infer<typeof updateRoomingAssignmentSchema>
export type RoomingListQuery = z.infer<typeof roomingListQuerySchema>
export type RoomingDelegateInput = z.infer<typeof setRoomingDelegatesSchema>["delegates"][number]
