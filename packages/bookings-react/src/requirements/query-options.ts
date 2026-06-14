"use client"

import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseBookingQuestionsOptions } from "./hooks/use-booking-questions.js"
import type { UseContactRequirementsOptions } from "./hooks/use-contact-requirements.js"
import type { UseProductsOptions } from "./hooks/use-products.js"
import type { UseQuestionOptionsOptions } from "./hooks/use-question-options.js"
import type { UseTransportRequirementsOptions } from "./hooks/use-transport-requirements.js"
import { bookingRequirementsQueryKeys } from "./query-keys.js"
import {
  bookingQuestionListResponse,
  bookingQuestionOptionListResponse,
  contactRequirementListResponse,
  productLiteListResponse,
  publicTransportRequirementsSchema,
} from "./schemas.js"

function appendPagination(params: URLSearchParams, filters: { limit?: number; offset?: number }) {
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
}

export function getProductsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseProductsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: bookingRequirementsQueryKeys.productsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/products${qs ? `?${qs}` : ""}`,
        productLiteListResponse,
        client,
      )
    },
  })
}

export function getContactRequirementsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseContactRequirementsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: bookingRequirementsQueryKeys.contactRequirementsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/booking-requirements/contact-requirements${qs ? `?${qs}` : ""}`,
        contactRequirementListResponse,
        client,
      )
    },
  })
}

export function getBookingQuestionsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseBookingQuestionsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: bookingRequirementsQueryKeys.questionsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/booking-requirements/questions${qs ? `?${qs}` : ""}`,
        bookingQuestionListResponse,
        client,
      )
    },
  })
}

export function getQuestionOptionsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseQuestionOptionsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: bookingRequirementsQueryKeys.questionOptionsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productBookingQuestionId) {
        params.set("productBookingQuestionId", filters.productBookingQuestionId)
      }
      appendPagination(params, filters)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/booking-requirements/question-options${qs ? `?${qs}` : ""}`,
        bookingQuestionOptionListResponse,
        client,
      )
    },
  })
}

export function getTransportRequirementsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseTransportRequirementsOptions,
) {
  const { enabled: _enabled = true, productId, optionId } = options
  return queryOptions({
    queryKey: bookingRequirementsQueryKeys.transportRequirementsDetail({ productId, optionId }),
    queryFn: () => {
      const params = new URLSearchParams()
      if (optionId) params.set("optionId", optionId)
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/public/booking-requirements/products/${productId}/transport-requirements${qs ? `?${qs}` : ""}`,
        z.object({ data: publicTransportRequirementsSchema }),
        client,
      )
    },
  })
}
