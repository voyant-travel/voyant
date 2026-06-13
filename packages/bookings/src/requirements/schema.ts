import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const contactRequirementFieldEnum = pgEnum("contact_requirement_field", [
  "first_name",
  "last_name",
  "email",
  "phone",
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry",
  "dietary_requirements",
  "accessibility_needs",
  "special_requests",
  "address",
  "other",
])

export const contactRequirementScopeEnum = pgEnum("contact_requirement_scope", [
  "booking",
  "lead_traveler",
  "traveler",
  "booker",
])

export const bookingQuestionTargetEnum = pgEnum("booking_question_target", [
  "booking",
  "traveler",
  "lead_traveler",
  "booker",
  "extra",
  "service",
])

export const bookingQuestionFieldTypeEnum = pgEnum("booking_question_field_type", [
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "date",
  "datetime",
  "boolean",
  "single_select",
  "multi_select",
  "file",
  "country",
  "other",
])

export const bookingQuestionTriggerModeEnum = pgEnum("booking_question_trigger_mode", [
  "required",
  "optional",
  "hidden",
])

export const bookingAnswerTargetEnum = pgEnum("booking_answer_target", [
  "booking",
  "traveler",
  "extra",
])

export const productContactRequirements = pgTable(
  "product_contact_requirements",
  {
    id: typeId("product_contact_requirements"),
    productId: text("product_id").notNull(),
    optionId: text("option_id"),
    fieldKey: contactRequirementFieldEnum("field_key").notNull(),
    scope: contactRequirementScopeEnum("scope").notNull().default("traveler"),
    isRequired: boolean("is_required").notNull().default(false),
    perTraveler: boolean("per_traveler").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_product_contact_requirements_sort").on(table.sortOrder),
    index("idx_product_contact_requirements_product_sort").on(table.productId, table.sortOrder),
    index("idx_product_contact_requirements_option_sort").on(table.optionId, table.sortOrder),
    index("idx_product_contact_requirements_active_sort").on(table.active, table.sortOrder),
    uniqueIndex("uidx_product_contact_requirements_scope_field").on(
      table.productId,
      table.optionId,
      table.scope,
      table.fieldKey,
    ),
  ],
)

export const productBookingQuestions = pgTable(
  "product_booking_questions",
  {
    id: typeId("product_booking_questions"),
    productId: text("product_id").notNull(),
    code: text("code"),
    label: text("label").notNull(),
    description: text("description"),
    target: bookingQuestionTargetEnum("target").notNull().default("booking"),
    fieldType: bookingQuestionFieldTypeEnum("field_type").notNull().default("text"),
    placeholder: text("placeholder"),
    helpText: text("help_text"),
    isRequired: boolean("is_required").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_product_booking_questions_sort").on(table.sortOrder),
    index("idx_product_booking_questions_product_sort").on(table.productId, table.sortOrder),
    index("idx_product_booking_questions_target_sort").on(table.target, table.sortOrder),
    index("idx_product_booking_questions_field_type_sort").on(table.fieldType, table.sortOrder),
    index("idx_product_booking_questions_active_sort").on(table.active, table.sortOrder),
    uniqueIndex("uidx_product_booking_questions_product_code").on(table.productId, table.code),
  ],
)

export const optionBookingQuestions = pgTable(
  "option_booking_questions",
  {
    id: typeId("option_booking_questions"),
    optionId: text("option_id").notNull(),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    isRequiredOverride: boolean("is_required_override"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_option_booking_questions_sort").on(table.sortOrder),
    index("idx_option_booking_questions_option_sort").on(table.optionId, table.sortOrder),
    index("idx_option_booking_questions_question_sort").on(
      table.productBookingQuestionId,
      table.sortOrder,
    ),
    index("idx_option_booking_questions_active_sort").on(table.active, table.sortOrder),
    uniqueIndex("uidx_option_booking_questions_option_question").on(
      table.optionId,
      table.productBookingQuestionId,
    ),
  ],
)

export const bookingQuestionOptions = pgTable(
  "booking_question_options",
  {
    id: typeId("booking_question_options"),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_question_options_sort").on(table.sortOrder),
    index("idx_booking_question_options_question_sort").on(
      table.productBookingQuestionId,
      table.sortOrder,
    ),
    index("idx_booking_question_options_active_sort").on(table.active, table.sortOrder),
    uniqueIndex("uidx_booking_question_options_question_value").on(
      table.productBookingQuestionId,
      table.value,
    ),
  ],
)

export const bookingQuestionUnitTriggers = pgTable(
  "booking_question_unit_triggers",
  {
    id: typeId("booking_question_unit_triggers"),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    unitId: text("unit_id").notNull(),
    triggerMode: bookingQuestionTriggerModeEnum("trigger_mode").notNull().default("required"),
    minQuantity: integer("min_quantity"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_question_unit_triggers_created").on(table.createdAt),
    index("idx_booking_question_unit_triggers_question_created").on(
      table.productBookingQuestionId,
      table.createdAt,
    ),
    index("idx_booking_question_unit_triggers_unit_created").on(table.unitId, table.createdAt),
    index("idx_booking_question_unit_triggers_active_created").on(table.active, table.createdAt),
    uniqueIndex("uidx_booking_question_unit_triggers_question_unit").on(
      table.productBookingQuestionId,
      table.unitId,
    ),
  ],
)

export const bookingQuestionOptionTriggers = pgTable(
  "booking_question_option_triggers",
  {
    id: typeId("booking_question_option_triggers"),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    optionId: text("option_id").notNull(),
    triggerMode: bookingQuestionTriggerModeEnum("trigger_mode").notNull().default("required"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_question_option_triggers_created").on(table.createdAt),
    index("idx_booking_question_option_triggers_question_created").on(
      table.productBookingQuestionId,
      table.createdAt,
    ),
    index("idx_booking_question_option_triggers_option_created").on(
      table.optionId,
      table.createdAt,
    ),
    index("idx_booking_question_option_triggers_active_created").on(table.active, table.createdAt),
    uniqueIndex("uidx_booking_question_option_triggers_question_option").on(
      table.productBookingQuestionId,
      table.optionId,
    ),
  ],
)

export const bookingQuestionExtraTriggers = pgTable(
  "booking_question_extra_triggers",
  {
    id: typeId("booking_question_extra_triggers"),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    productExtraId: text("product_extra_id"),
    optionExtraConfigId: text("option_extra_config_id"),
    triggerMode: bookingQuestionTriggerModeEnum("trigger_mode").notNull().default("required"),
    minQuantity: integer("min_quantity"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_question_extra_triggers_created").on(table.createdAt),
    index("idx_booking_question_extra_triggers_question_created").on(
      table.productBookingQuestionId,
      table.createdAt,
    ),
    index("idx_booking_question_extra_triggers_product_extra_created").on(
      table.productExtraId,
      table.createdAt,
    ),
    index("idx_booking_question_extra_triggers_option_extra_config_created").on(
      table.optionExtraConfigId,
      table.createdAt,
    ),
    index("idx_booking_question_extra_triggers_active_created").on(table.active, table.createdAt),
  ],
)

export const bookingAnswers = pgTable(
  "booking_answers",
  {
    id: typeId("booking_answers"),
    bookingId: text("booking_id").notNull(),
    productBookingQuestionId: typeIdRef("product_booking_question_id")
      .notNull()
      .references(() => productBookingQuestions.id, { onDelete: "cascade" }),
    bookingTravelerId: text("booking_traveler_id"),
    bookingExtraId: text("booking_extra_id"),
    target: bookingAnswerTargetEnum("target").notNull().default("booking"),
    valueText: text("value_text"),
    valueNumber: integer("value_number"),
    valueBoolean: boolean("value_boolean"),
    valueJson: jsonb("value_json").$type<Record<string, unknown> | string[] | null>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_answers_booking_updated").on(table.bookingId, table.updatedAt),
    index("idx_booking_answers_question_updated").on(
      table.productBookingQuestionId,
      table.updatedAt,
    ),
    index("idx_booking_answers_traveler_updated").on(table.bookingTravelerId, table.updatedAt),
    index("idx_booking_answers_booking_extra_updated").on(table.bookingExtraId, table.updatedAt),
    index("idx_booking_answers_target_updated").on(table.target, table.updatedAt),
  ],
)

export type ProductContactRequirement = typeof productContactRequirements.$inferSelect
export type NewProductContactRequirement = typeof productContactRequirements.$inferInsert
export type ProductBookingQuestion = typeof productBookingQuestions.$inferSelect
export type NewProductBookingQuestion = typeof productBookingQuestions.$inferInsert
export type OptionBookingQuestion = typeof optionBookingQuestions.$inferSelect
export type NewOptionBookingQuestion = typeof optionBookingQuestions.$inferInsert
export type BookingQuestionOption = typeof bookingQuestionOptions.$inferSelect
export type NewBookingQuestionOption = typeof bookingQuestionOptions.$inferInsert
export type BookingQuestionUnitTrigger = typeof bookingQuestionUnitTriggers.$inferSelect
export type NewBookingQuestionUnitTrigger = typeof bookingQuestionUnitTriggers.$inferInsert
export type BookingQuestionOptionTrigger = typeof bookingQuestionOptionTriggers.$inferSelect
export type NewBookingQuestionOptionTrigger = typeof bookingQuestionOptionTriggers.$inferInsert
export type BookingQuestionExtraTrigger = typeof bookingQuestionExtraTriggers.$inferSelect
export type NewBookingQuestionExtraTrigger = typeof bookingQuestionExtraTriggers.$inferInsert
export type BookingAnswer = typeof bookingAnswers.$inferSelect
export type NewBookingAnswer = typeof bookingAnswers.$inferInsert

export const productContactRequirementsRelations = relations(productContactRequirements, () => ({}))

export const productBookingQuestionsRelations = relations(productBookingQuestions, ({ many }) => ({
  optionQuestions: many(optionBookingQuestions),
  options: many(bookingQuestionOptions),
  unitTriggers: many(bookingQuestionUnitTriggers),
  optionTriggers: many(bookingQuestionOptionTriggers),
  extraTriggers: many(bookingQuestionExtraTriggers),
  answers: many(bookingAnswers),
}))

export const optionBookingQuestionsRelations = relations(optionBookingQuestions, ({ one }) => ({
  productBookingQuestion: one(productBookingQuestions, {
    fields: [optionBookingQuestions.productBookingQuestionId],
    references: [productBookingQuestions.id],
  }),
}))

export const bookingQuestionOptionsRelations = relations(bookingQuestionOptions, ({ one }) => ({
  productBookingQuestion: one(productBookingQuestions, {
    fields: [bookingQuestionOptions.productBookingQuestionId],
    references: [productBookingQuestions.id],
  }),
}))

export const bookingQuestionUnitTriggersRelations = relations(
  bookingQuestionUnitTriggers,
  ({ one }) => ({
    productBookingQuestion: one(productBookingQuestions, {
      fields: [bookingQuestionUnitTriggers.productBookingQuestionId],
      references: [productBookingQuestions.id],
    }),
  }),
)

export const bookingQuestionOptionTriggersRelations = relations(
  bookingQuestionOptionTriggers,
  ({ one }) => ({
    productBookingQuestion: one(productBookingQuestions, {
      fields: [bookingQuestionOptionTriggers.productBookingQuestionId],
      references: [productBookingQuestions.id],
    }),
  }),
)

export const bookingQuestionExtraTriggersRelations = relations(
  bookingQuestionExtraTriggers,
  ({ one }) => ({
    productBookingQuestion: one(productBookingQuestions, {
      fields: [bookingQuestionExtraTriggers.productBookingQuestionId],
      references: [productBookingQuestions.id],
    }),
  }),
)

export const bookingAnswersRelations = relations(bookingAnswers, ({ one }) => ({
  productBookingQuestion: one(productBookingQuestions, {
    fields: [bookingAnswers.productBookingQuestionId],
    references: [productBookingQuestions.id],
  }),
}))
