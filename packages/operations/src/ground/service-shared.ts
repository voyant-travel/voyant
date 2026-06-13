import type { z } from "zod"

import type {
  groundDispatchAssignmentListQuerySchema,
  groundDispatchCheckpointListQuerySchema,
  groundDispatchLegListQuerySchema,
  groundDispatchListQuerySchema,
  groundDispatchPassengerListQuerySchema,
  groundDriverListQuerySchema,
  groundDriverShiftListQuerySchema,
  groundExecutionEventListQuerySchema,
  groundOperatorListQuerySchema,
  groundServiceIncidentListQuerySchema,
  groundTransferPreferenceListQuerySchema,
  groundVehicleListQuerySchema,
  insertGroundDispatchAssignmentSchema,
  insertGroundDispatchCheckpointSchema,
  insertGroundDispatchLegSchema,
  insertGroundDispatchPassengerSchema,
  insertGroundDispatchSchema,
  insertGroundDriverSchema,
  insertGroundDriverShiftSchema,
  insertGroundExecutionEventSchema,
  insertGroundOperatorSchema,
  insertGroundServiceIncidentSchema,
  insertGroundTransferPreferenceSchema,
  insertGroundVehicleSchema,
  updateGroundDispatchAssignmentSchema,
  updateGroundDispatchCheckpointSchema,
  updateGroundDispatchLegSchema,
  updateGroundDispatchPassengerSchema,
  updateGroundDispatchSchema,
  updateGroundDriverSchema,
  updateGroundDriverShiftSchema,
  updateGroundExecutionEventSchema,
  updateGroundOperatorSchema,
  updateGroundServiceIncidentSchema,
  updateGroundTransferPreferenceSchema,
  updateGroundVehicleSchema,
} from "./validation.js"

export type GroundOperatorListQuery = z.infer<typeof groundOperatorListQuerySchema>
export type CreateGroundOperatorInput = z.infer<typeof insertGroundOperatorSchema>
export type UpdateGroundOperatorInput = z.infer<typeof updateGroundOperatorSchema>
export type GroundVehicleListQuery = z.infer<typeof groundVehicleListQuerySchema>
export type CreateGroundVehicleInput = z.infer<typeof insertGroundVehicleSchema>
export type UpdateGroundVehicleInput = z.infer<typeof updateGroundVehicleSchema>
export type GroundDriverListQuery = z.infer<typeof groundDriverListQuerySchema>
export type CreateGroundDriverInput = z.infer<typeof insertGroundDriverSchema>
export type UpdateGroundDriverInput = z.infer<typeof updateGroundDriverSchema>
export type GroundTransferPreferenceListQuery = z.infer<
  typeof groundTransferPreferenceListQuerySchema
>
export type CreateGroundTransferPreferenceInput = z.infer<
  typeof insertGroundTransferPreferenceSchema
>
export type UpdateGroundTransferPreferenceInput = z.infer<
  typeof updateGroundTransferPreferenceSchema
>
export type GroundDispatchListQuery = z.infer<typeof groundDispatchListQuerySchema>
export type CreateGroundDispatchInput = z.infer<typeof insertGroundDispatchSchema>
export type UpdateGroundDispatchInput = z.infer<typeof updateGroundDispatchSchema>
export type GroundExecutionEventListQuery = z.infer<typeof groundExecutionEventListQuerySchema>
export type CreateGroundExecutionEventInput = z.infer<typeof insertGroundExecutionEventSchema>
export type UpdateGroundExecutionEventInput = z.infer<typeof updateGroundExecutionEventSchema>
export type GroundDispatchAssignmentListQuery = z.infer<
  typeof groundDispatchAssignmentListQuerySchema
>
export type CreateGroundDispatchAssignmentInput = z.infer<
  typeof insertGroundDispatchAssignmentSchema
>
export type UpdateGroundDispatchAssignmentInput = z.infer<
  typeof updateGroundDispatchAssignmentSchema
>
export type GroundDispatchLegListQuery = z.infer<typeof groundDispatchLegListQuerySchema>
export type CreateGroundDispatchLegInput = z.infer<typeof insertGroundDispatchLegSchema>
export type UpdateGroundDispatchLegInput = z.infer<typeof updateGroundDispatchLegSchema>
export type GroundDispatchPassengerListQuery = z.infer<
  typeof groundDispatchPassengerListQuerySchema
>
export type CreateGroundDispatchPassengerInput = z.infer<typeof insertGroundDispatchPassengerSchema>
export type UpdateGroundDispatchPassengerInput = z.infer<typeof updateGroundDispatchPassengerSchema>
export type GroundDriverShiftListQuery = z.infer<typeof groundDriverShiftListQuerySchema>
export type CreateGroundDriverShiftInput = z.infer<typeof insertGroundDriverShiftSchema>
export type UpdateGroundDriverShiftInput = z.infer<typeof updateGroundDriverShiftSchema>
export type GroundServiceIncidentListQuery = z.infer<typeof groundServiceIncidentListQuerySchema>
export type CreateGroundServiceIncidentInput = z.infer<typeof insertGroundServiceIncidentSchema>
export type UpdateGroundServiceIncidentInput = z.infer<typeof updateGroundServiceIncidentSchema>
export type GroundDispatchCheckpointListQuery = z.infer<
  typeof groundDispatchCheckpointListQuerySchema
>
export type CreateGroundDispatchCheckpointInput = z.infer<
  typeof insertGroundDispatchCheckpointSchema
>
export type UpdateGroundDispatchCheckpointInput = z.infer<
  typeof updateGroundDispatchCheckpointSchema
>

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

export function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}
