import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BookingRequirementsContactTab } from "./components/booking-requirements-contact-tab.js"
import { BookingRequirementsQuestionsTab } from "./components/booking-requirements-questions-tab.js"
import {
  BookingRequirementsUiMessagesProvider,
  getBookingRequirementsUiI18n,
  resolveBookingRequirementsUiMessages,
} from "./i18n/index.js"
import type { BookingQuestion, BookingQuestionOption, ContactRequirement } from "./index.js"

describe("booking-requirements-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveBookingRequirementsUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            questionsTab: {
              addChoice: "Adauga Varianta",
            },
          },
        },
      },
    })

    expect(result.questionsTab.addChoice).toBe("Adauga Varianta")
    expect(result.common.scopeLabels.lead_traveler).toBe("Calator principal")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getBookingRequirementsUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(
      <>
        <BookingRequirementsContactTab
          rows={[contactRow]}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
        <BookingRequirementsQuestionsTab
          rows={[question]}
          expandedIds={new Set([question.id])}
          questionOptionsById={new Map([[question.id, [option]]])}
          onToggle={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onCreateOption={() => {}}
          onEditOption={() => {}}
          onDeleteOption={() => {}}
        />
      </>,
    )

    expect(html).toContain("Contact requirements")
    expect(html).toContain("Passport number")
    expect(html).toContain("Custom questions")
    expect(html).toContain("Single select")
    expect(html).toContain("Add choice")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <BookingRequirementsUiMessagesProvider locale="ro-RO">
        <div>
          <BookingRequirementsContactTab
            rows={[contactRow]}
            onCreate={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
          <BookingRequirementsQuestionsTab
            rows={[question]}
            expandedIds={new Set([question.id])}
            questionOptionsById={new Map([[question.id, [option]]])}
            onToggle={() => {}}
            onCreate={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            onCreateOption={() => {}}
            onEditOption={() => {}}
            onDeleteOption={() => {}}
          />
        </div>
      </BookingRequirementsUiMessagesProvider>,
    )

    expect(html).toContain("Cerinte de contact")
    expect(html).toContain("Numar pasaport")
    expect(html).toContain("Intrebari personalizate")
    expect(html).toContain("Selectie simpla")
    expect(html).toContain("Adauga optiune")
  })
})

const contactRow: ContactRequirement = {
  id: "contact-1",
  productId: "product-1",
  optionId: null,
  fieldKey: "passport_number",
  scope: "lead_traveler",
  isRequired: true,
  perTraveler: true,
  active: true,
  sortOrder: 3,
  notes: null,
}

const question: BookingQuestion = {
  id: "question-1",
  productId: "product-1",
  code: "diet",
  label: "Dietary preference",
  description: "Collect dietary requirements before departure.",
  target: "traveler",
  fieldType: "single_select",
  placeholder: null,
  helpText: null,
  isRequired: true,
  active: true,
  sortOrder: 1,
}

const option: BookingQuestionOption = {
  id: "option-1",
  productBookingQuestionId: "question-1",
  value: "vegan",
  label: "Vegan",
  sortOrder: 0,
  isDefault: true,
  active: true,
}
