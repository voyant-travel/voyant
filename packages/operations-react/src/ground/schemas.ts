import {
  insertGroundDriverSchema,
  insertGroundOperatorSchema,
  insertGroundVehicleSchema,
} from "@voyantjs/operations"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const groundOperatorRecordSchema = insertGroundOperatorSchema.extend({
  id: z.string(),
  supplierId: z.string().nullable(),
  facilityId: z.string().nullable(),
  code: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type GroundOperatorRecord = z.infer<typeof groundOperatorRecordSchema>

export const groundVehicleRecordSchema = insertGroundVehicleSchema.extend({
  id: z.string(),
  operatorId: z.string().nullable(),
  passengerCapacity: z.number().int().nullable(),
  checkedBagCapacity: z.number().int().nullable(),
  carryOnCapacity: z.number().int().nullable(),
  wheelchairCapacity: z.number().int().nullable(),
  childSeatCapacity: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type GroundVehicleRecord = z.infer<typeof groundVehicleRecordSchema>

export const groundDriverRecordSchema = insertGroundDriverSchema.extend({
  id: z.string(),
  operatorId: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type GroundDriverRecord = z.infer<typeof groundDriverRecordSchema>

export const groundOperatorListResponse = paginatedEnvelope(groundOperatorRecordSchema)
export const groundOperatorSingleResponse = singleEnvelope(groundOperatorRecordSchema)
export const groundVehicleListResponse = paginatedEnvelope(groundVehicleRecordSchema)
export const groundVehicleSingleResponse = singleEnvelope(groundVehicleRecordSchema)
export const groundDriverListResponse = paginatedEnvelope(groundDriverRecordSchema)
export const groundDriverSingleResponse = singleEnvelope(groundDriverRecordSchema)
