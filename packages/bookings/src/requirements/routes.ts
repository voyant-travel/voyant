import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

import { bookingRequirementsService } from "./service.js"
import {
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
  updateBookingAnswerSchema,
  updateBookingQuestionExtraTriggerSchema,
  updateBookingQuestionOptionSchema,
  updateBookingQuestionOptionTriggerSchema,
  updateBookingQuestionUnitTriggerSchema,
  updateOptionBookingQuestionSchema,
  updateProductBookingQuestionSchema,
  updateProductContactRequirementSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const bookingRequirementsRoutes = new Hono<Env>()
  .get("/contact-requirements", async (c) => {
    const query = parseQuery(c, productContactRequirementListQuerySchema)
    return c.json(
      await bookingRequirementsService.listProductContactRequirements(c.get("db"), query),
    )
  })
  .post("/contact-requirements", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createProductContactRequirement(
          c.get("db"),
          await parseJsonBody(c, insertProductContactRequirementSchema),
        ),
      },
      201,
    )
  })
  .get("/contact-requirements/:id", async (c) => {
    const row = await bookingRequirementsService.getProductContactRequirementById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/contact-requirements/:id", async (c) => {
    const row = await bookingRequirementsService.updateProductContactRequirement(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductContactRequirementSchema),
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/contact-requirements/:id", async (c) => {
    const row = await bookingRequirementsService.deleteProductContactRequirement(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ success: true })
  })
  .get("/questions", async (c) => {
    const query = parseQuery(c, productBookingQuestionListQuerySchema)
    return c.json(await bookingRequirementsService.listProductBookingQuestions(c.get("db"), query))
  })
  .post("/questions", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createProductBookingQuestion(
          c.get("db"),
          await parseJsonBody(c, insertProductBookingQuestionSchema),
        ),
      },
      201,
    )
  })
  .get("/questions/:id", async (c) => {
    const row = await bookingRequirementsService.getProductBookingQuestionById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/questions/:id", async (c) => {
    const row = await bookingRequirementsService.updateProductBookingQuestion(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductBookingQuestionSchema),
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/questions/:id", async (c) => {
    const row = await bookingRequirementsService.deleteProductBookingQuestion(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ success: true })
  })
  .get("/option-questions", async (c) => {
    const query = parseQuery(c, optionBookingQuestionListQuerySchema)
    return c.json(await bookingRequirementsService.listOptionBookingQuestions(c.get("db"), query))
  })
  .post("/option-questions", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createOptionBookingQuestion(
          c.get("db"),
          await parseJsonBody(c, insertOptionBookingQuestionSchema),
        ),
      },
      201,
    )
  })
  .get("/option-questions/:id", async (c) => {
    const row = await bookingRequirementsService.getOptionBookingQuestionById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/option-questions/:id", async (c) => {
    const row = await bookingRequirementsService.updateOptionBookingQuestion(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateOptionBookingQuestionSchema),
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/option-questions/:id", async (c) => {
    const row = await bookingRequirementsService.deleteOptionBookingQuestion(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ success: true })
  })
  .get("/question-options", async (c) => {
    const query = parseQuery(c, bookingQuestionOptionListQuerySchema)
    return c.json(await bookingRequirementsService.listBookingQuestionOptions(c.get("db"), query))
  })
  .post("/question-options", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createBookingQuestionOption(
          c.get("db"),
          await parseJsonBody(c, insertBookingQuestionOptionSchema),
        ),
      },
      201,
    )
  })
  .get("/question-options/:id", async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionOptionById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/question-options/:id", async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionOption(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingQuestionOptionSchema),
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/question-options/:id", async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionOption(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ success: true })
  })
  .get("/unit-triggers", async (c) => {
    const query = parseQuery(c, bookingQuestionUnitTriggerListQuerySchema)
    return c.json(
      await bookingRequirementsService.listBookingQuestionUnitTriggers(c.get("db"), query),
    )
  })
  .post("/unit-triggers", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createBookingQuestionUnitTrigger(
          c.get("db"),
          await parseJsonBody(c, insertBookingQuestionUnitTriggerSchema),
        ),
      },
      201,
    )
  })
  .get("/unit-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionUnitTriggerById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/unit-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionUnitTrigger(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingQuestionUnitTriggerSchema),
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/unit-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionUnitTrigger(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ success: true })
  })
  .get("/option-triggers", async (c) => {
    const query = parseQuery(c, bookingQuestionOptionTriggerListQuerySchema)
    return c.json(
      await bookingRequirementsService.listBookingQuestionOptionTriggers(c.get("db"), query),
    )
  })
  .post("/option-triggers", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createBookingQuestionOptionTrigger(
          c.get("db"),
          await parseJsonBody(c, insertBookingQuestionOptionTriggerSchema),
        ),
      },
      201,
    )
  })
  .get("/option-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionOptionTriggerById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/option-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionOptionTrigger(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingQuestionOptionTriggerSchema),
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/option-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionOptionTrigger(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ success: true })
  })
  .get("/extra-triggers", async (c) => {
    const query = parseQuery(c, bookingQuestionExtraTriggerListQuerySchema)
    return c.json(
      await bookingRequirementsService.listBookingQuestionExtraTriggers(c.get("db"), query),
    )
  })
  .post("/extra-triggers", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createBookingQuestionExtraTrigger(
          c.get("db"),
          await parseJsonBody(c, insertBookingQuestionExtraTriggerSchema),
        ),
      },
      201,
    )
  })
  .get("/extra-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionExtraTriggerById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/extra-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionExtraTrigger(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingQuestionExtraTriggerSchema),
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/extra-triggers/:id", async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionExtraTrigger(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ success: true })
  })
  .get("/answers", async (c) => {
    const query = parseQuery(c, bookingAnswerListQuerySchema)
    return c.json(await bookingRequirementsService.listBookingAnswers(c.get("db"), query))
  })
  .post("/answers", async (c) => {
    return c.json(
      {
        data: await bookingRequirementsService.createBookingAnswer(
          c.get("db"),
          await parseJsonBody(c, insertBookingAnswerSchema),
        ),
      },
      201,
    )
  })
  .get("/answers/:id", async (c) => {
    const row = await bookingRequirementsService.getBookingAnswerById(
      c.get("db"),
      c.req.param("id"),
    )
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ data: row })
  })
  .patch("/answers/:id", async (c) => {
    const row = await bookingRequirementsService.updateBookingAnswer(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateBookingAnswerSchema),
    )
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ data: row })
  })
  .delete("/answers/:id", async (c) => {
    const row = await bookingRequirementsService.deleteBookingAnswer(c.get("db"), c.req.param("id"))
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ success: true })
  })

export type BookingRequirementsRoutes = typeof bookingRequirementsRoutes
