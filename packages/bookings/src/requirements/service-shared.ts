import type { z } from "zod"

import type {
  bookingAnswerListQuerySchema,
  bookingQuestionExtraTriggerListQuerySchema,
  bookingQuestionOptionListQuerySchema,
  bookingQuestionOptionTriggerListQuerySchema,
  bookingQuestionUnitTriggerListQuerySchema,
  insertBookingAnswerSchema,
  insertBookingQuestionExtraTriggerSchema,
  insertBookingQuestionOptionSchema,
  insertBookingQuestionOptionTriggerSchema,
  insertBookingQuestionUnitTriggerSchema,
  insertOptionBookingQuestionSchema,
  insertProductBookingQuestionSchema,
  insertProductContactRequirementSchema,
  optionBookingQuestionListQuerySchema,
  productBookingQuestionListQuerySchema,
  productContactRequirementListQuerySchema,
  publicTransportRequirementsQuerySchema,
  publicTransportRequirementsSchema,
  updateBookingAnswerSchema,
  updateBookingQuestionExtraTriggerSchema,
  updateBookingQuestionOptionSchema,
  updateBookingQuestionOptionTriggerSchema,
  updateBookingQuestionUnitTriggerSchema,
  updateOptionBookingQuestionSchema,
  updateProductBookingQuestionSchema,
  updateProductContactRequirementSchema,
} from "./validation.js"

export type ProductContactRequirementListQuery = z.infer<
  typeof productContactRequirementListQuerySchema
>
export type PublicTransportRequirementsQuery = z.infer<
  typeof publicTransportRequirementsQuerySchema
>
export type PublicTransportRequirements = z.infer<typeof publicTransportRequirementsSchema>
export type ProductBookingQuestionListQuery = z.infer<typeof productBookingQuestionListQuerySchema>
export type OptionBookingQuestionListQuery = z.infer<typeof optionBookingQuestionListQuerySchema>
export type BookingQuestionOptionListQuery = z.infer<typeof bookingQuestionOptionListQuerySchema>
export type BookingQuestionUnitTriggerListQuery = z.infer<
  typeof bookingQuestionUnitTriggerListQuerySchema
>
export type BookingQuestionOptionTriggerListQuery = z.infer<
  typeof bookingQuestionOptionTriggerListQuerySchema
>
export type BookingQuestionExtraTriggerListQuery = z.infer<
  typeof bookingQuestionExtraTriggerListQuerySchema
>
export type BookingAnswerListQuery = z.infer<typeof bookingAnswerListQuerySchema>

export type CreateProductContactRequirementInput = z.infer<
  typeof insertProductContactRequirementSchema
>
export type UpdateProductContactRequirementInput = z.infer<
  typeof updateProductContactRequirementSchema
>
export type CreateProductBookingQuestionInput = z.infer<typeof insertProductBookingQuestionSchema>
export type UpdateProductBookingQuestionInput = z.infer<typeof updateProductBookingQuestionSchema>
export type CreateOptionBookingQuestionInput = z.infer<typeof insertOptionBookingQuestionSchema>
export type UpdateOptionBookingQuestionInput = z.infer<typeof updateOptionBookingQuestionSchema>
export type CreateBookingQuestionOptionInput = z.infer<typeof insertBookingQuestionOptionSchema>
export type UpdateBookingQuestionOptionInput = z.infer<typeof updateBookingQuestionOptionSchema>
export type CreateBookingQuestionUnitTriggerInput = z.infer<
  typeof insertBookingQuestionUnitTriggerSchema
>
export type UpdateBookingQuestionUnitTriggerInput = z.infer<
  typeof updateBookingQuestionUnitTriggerSchema
>
export type CreateBookingQuestionOptionTriggerInput = z.infer<
  typeof insertBookingQuestionOptionTriggerSchema
>
export type UpdateBookingQuestionOptionTriggerInput = z.infer<
  typeof updateBookingQuestionOptionTriggerSchema
>
export type CreateBookingQuestionExtraTriggerInput = z.infer<
  typeof insertBookingQuestionExtraTriggerSchema
>
export type UpdateBookingQuestionExtraTriggerInput = z.infer<
  typeof updateBookingQuestionExtraTriggerSchema
>
export type CreateBookingAnswerInput = z.infer<typeof insertBookingAnswerSchema>
export type UpdateBookingAnswerInput = z.infer<typeof updateBookingAnswerSchema>

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}
