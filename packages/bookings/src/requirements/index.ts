import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"
import { createBookingRequirementsRuntime } from "../runtime.js"
import { bookingsInventoryRuntimePort } from "../runtime-port.js"
import { bookingRequirementsRoutes } from "./routes.js"
import {
  createPublicBookingRequirementsRoutes,
  type PublicBookingRequirementsRoutesOptions,
  publicBookingRequirementsRoutes,
} from "./routes-public.js"
import { bookingRequirementsService } from "./service.js"

export type { BookingRequirementsRoutes } from "./routes.js"
export type { PublicBookingRequirementsRoutes } from "./routes-public.js"

export const bookingRequirementsModule: Module = {
  name: "booking-requirements",
}

export const bookingRequirementsHonoModule: HonoModule = {
  module: bookingRequirementsModule,
  adminRoutes: bookingRequirementsRoutes,
  publicRoutes: publicBookingRequirementsRoutes,
}

export interface BookingRequirementsHonoModuleOptions {
  publicRoutes?: PublicBookingRequirementsRoutesOptions
}

export function createBookingRequirementsHonoModule(
  options: BookingRequirementsHonoModuleOptions = {},
): HonoModule {
  return {
    module: bookingRequirementsModule,
    adminRoutes: bookingRequirementsRoutes,
    publicRoutes: options.publicRoutes
      ? createPublicBookingRequirementsRoutes(options.publicRoutes)
      : publicBookingRequirementsRoutes,
  }
}

export const createBookingRequirementsVoyantRuntime = defineGraphRuntimeFactory(
  async ({ api, getPort }) => {
    const configured = createBookingRequirementsHonoModule(
      createBookingRequirementsRuntime(await getPort(bookingsInventoryRuntimePort)),
    )
    const selected: HonoModule = { module: configured.module }
    if (api.some(({ surface }) => surface === "admin") && configured.adminRoutes) {
      selected.adminRoutes = configured.adminRoutes
    }
    if (api.some(({ surface }) => surface === "public") && configured.publicRoutes) {
      selected.publicRoutes = configured.publicRoutes
    }
    return selected
  },
)

export {
  createPublicBookingRequirementsRoutes,
  publicBookingRequirementsRoutes,
} from "./routes-public.js"
export type {
  BookingAnswer,
  BookingQuestionExtraTrigger,
  BookingQuestionOption,
  BookingQuestionOptionTrigger,
  BookingQuestionUnitTrigger,
  NewBookingAnswer,
  NewBookingQuestionExtraTrigger,
  NewBookingQuestionOption,
  NewBookingQuestionOptionTrigger,
  NewBookingQuestionUnitTrigger,
  NewOptionBookingQuestion,
  NewProductBookingQuestion,
  NewProductContactRequirement,
  OptionBookingQuestion,
  ProductBookingQuestion,
  ProductContactRequirement,
} from "./schema.js"
export {
  bookingAnswers,
  bookingAnswerTargetEnum,
  bookingQuestionExtraTriggers,
  bookingQuestionFieldTypeEnum,
  bookingQuestionOptions,
  bookingQuestionOptionTriggers,
  bookingQuestionTargetEnum,
  bookingQuestionTriggerModeEnum,
  bookingQuestionUnitTriggers,
  contactRequirementFieldEnum,
  contactRequirementScopeEnum,
  optionBookingQuestions,
  productBookingQuestions,
  productContactRequirements,
} from "./schema.js"
export type {
  BookingRequirementsProductSnapshot,
  ResolveBookingRequirementsProductSnapshot,
} from "./service-public.js"
export {
  bookingAnswerListQuerySchema,
  bookingAnswerTargetSchema,
  bookingQuestionExtraTriggerListQuerySchema,
  bookingQuestionFieldTypeSchema,
  bookingQuestionOptionListQuerySchema,
  bookingQuestionOptionTriggerListQuerySchema,
  bookingQuestionTargetSchema,
  bookingQuestionTriggerModeSchema,
  bookingQuestionUnitTriggerListQuerySchema,
  contactRequirementFieldSchema,
  contactRequirementScopeSchema,
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
  publicTransportRequirementSummarySchema,
  publicTransportRequirementsQuerySchema,
  publicTransportRequirementsSchema,
  transportRequirementFieldSchema,
  updateBookingAnswerSchema,
  updateBookingQuestionExtraTriggerSchema,
  updateBookingQuestionOptionSchema,
  updateBookingQuestionOptionTriggerSchema,
  updateBookingQuestionUnitTriggerSchema,
  updateOptionBookingQuestionSchema,
  updateProductBookingQuestionSchema,
  updateProductContactRequirementSchema,
} from "./validation.js"
export { bookingRequirementsService }
