import type { BookingQuestion, ContactRequirement } from "../index.js"

export type ContactFieldKey = ContactRequirement["fieldKey"]
export type ContactScope = ContactRequirement["scope"]
export type QuestionTarget = BookingQuestion["target"]
export type QuestionFieldType = BookingQuestion["fieldType"]

export type BookingRequirementsUiMessages = {
  common: {
    edit: string
    delete: string
    add: string
    show: string
    hide: string
    required: string
    optional: string
    yes: string
    no: string
    active: string
    inactive: string
    default: string
    fieldKeyLabels: Record<ContactFieldKey, string>
    scopeLabels: Record<ContactScope, string>
    questionTargetLabels: Record<QuestionTarget, string>
    questionFieldTypeLabels: Record<QuestionFieldType, string>
  }
  contactTab: {
    title: string
    description: string
    addRequirement: string
    empty: string
    columns: {
      field: string
      scope: string
      required: string
      perTraveler: string
      sort: string
      status: string
      actions: string
    }
  }
  questionsTab: {
    title: string
    description: string
    addQuestion: string
    empty: string
    choiceTypesHint: string
    choices: string
    addChoice: string
    noChoices: string
    columns: {
      sort: string
      value: string
      label: string
      default: string
      status: string
      actions: string
    }
  }
}
