import { queryOptions } from "@tanstack/react-query"
import {
  type CustomerBusinessAccountCapabilitiesDto,
  type CustomerBusinessAccountDecisionInput,
  type CustomerBusinessAccountDto,
  type CustomerBusinessAccountProvisionInput,
  type CustomerBusinessAccountRequestDto,
  type CustomerBusinessAccountRequestStatus,
  customerBusinessAccountCapabilitiesSchema,
  customerBusinessAccountProvisionInputSchema,
  customerBusinessAccountRequestSchema,
  customerBusinessAccountSchema,
} from "@voyant-travel/auth/customer-business-accounts"
import { z } from "zod"

import { fetchWithValidation, type VoyantFetcher, withQueryParams } from "./client.js"
import { authQueryKeys } from "./query-keys.js"

const capabilitiesResponseSchema = z
  .object({ data: customerBusinessAccountCapabilitiesSchema })
  .strict()
const requestsResponseSchema = z
  .object({ data: z.array(customerBusinessAccountRequestSchema) })
  .strict()
const requestResponseSchema = z.object({ data: customerBusinessAccountRequestSchema }).strict()
const accountResponseSchema = z.object({ data: customerBusinessAccountSchema }).strict()

export interface CustomerBusinessAccountsAdminApi {
  getCapabilities: () => Promise<CustomerBusinessAccountCapabilitiesDto>
  listRequests: (filters?: {
    status?: CustomerBusinessAccountRequestStatus
  }) => Promise<CustomerBusinessAccountRequestDto[]>
  approveRequest: (
    requestId: string,
    input?: CustomerBusinessAccountDecisionInput,
  ) => Promise<CustomerBusinessAccountRequestDto>
  rejectRequest: (
    requestId: string,
    input?: CustomerBusinessAccountDecisionInput,
  ) => Promise<CustomerBusinessAccountRequestDto>
  provisionAccount: (
    input: CustomerBusinessAccountProvisionInput,
  ) => Promise<CustomerBusinessAccountDto>
}

export function createCustomerBusinessAccountsAdminApi(
  baseUrl: string,
  fetcher: VoyantFetcher,
): CustomerBusinessAccountsAdminApi {
  const options = { baseUrl, fetcher }
  const decide = async (
    requestId: string,
    decision: "approve" | "reject",
    input: CustomerBusinessAccountDecisionInput = {},
  ) =>
    (
      await fetchWithValidation(
        `/v1/admin/customer-business-accounts/requests/${encodeURIComponent(requestId)}/${decision}`,
        requestResponseSchema,
        options,
        { method: "POST", credentials: "include", body: JSON.stringify(input) },
      )
    ).data

  return {
    async getCapabilities() {
      return (
        await fetchWithValidation(
          "/v1/admin/customer-business-accounts/capabilities",
          capabilitiesResponseSchema,
          options,
          { method: "GET", credentials: "include" },
        )
      ).data
    },
    async listRequests(filters = {}) {
      return (
        await fetchWithValidation(
          withQueryParams("/v1/admin/customer-business-accounts/requests", filters),
          requestsResponseSchema,
          options,
          { method: "GET", credentials: "include" },
        )
      ).data
    },
    approveRequest: (requestId, input) => decide(requestId, "approve", input),
    rejectRequest: (requestId, input) => decide(requestId, "reject", input),
    async provisionAccount(input) {
      const body = customerBusinessAccountProvisionInputSchema.parse(input)
      return (
        await fetchWithValidation(
          "/v1/admin/customer-business-accounts/accounts",
          accountResponseSchema,
          options,
          { method: "POST", credentials: "include", body: JSON.stringify(body) },
        )
      ).data
    },
  }
}

export const customerBusinessAccountCapabilitiesQueryOptions = (
  api: CustomerBusinessAccountsAdminApi,
) =>
  queryOptions({
    queryKey: authQueryKeys.customerBusinessAccountCapabilities(),
    queryFn: () => api.getCapabilities(),
  })

export const customerBusinessAccountRequestsQueryOptions = (
  api: CustomerBusinessAccountsAdminApi,
  filters: { status?: CustomerBusinessAccountRequestStatus } = {},
) =>
  queryOptions({
    queryKey: authQueryKeys.customerBusinessAccountRequests(filters),
    queryFn: () => api.listRequests(filters),
  })
