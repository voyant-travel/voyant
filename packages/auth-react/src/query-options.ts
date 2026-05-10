"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation, withQueryParams } from "./client.js"
import {
  authQueryKeys,
  type OrganizationInvitationsListFilters,
  type OrganizationMembersListFilters,
  type ServiceApiKeysListFilters,
} from "./query-keys.js"
import {
  authStatusSchema,
  currentUserSchema,
  currentWorkspaceSchema,
  organizationInvitationsResponseSchema,
  organizationMembersResponseSchema,
  serviceApiKeysResponseSchema,
} from "./schemas.js"

export function getCurrentUserQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: authQueryKeys.currentUser(),
    queryFn: () => fetchWithValidation("/auth/me", currentUserSchema, client),
  })
}

export function getAuthStatusQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: authQueryKeys.authStatus(),
    queryFn: () => fetchWithValidation("/auth/status", authStatusSchema, client),
  })
}

export function getCurrentWorkspaceQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: authQueryKeys.currentWorkspace(),
    queryFn: () => fetchWithValidation("/auth/workspace/current", currentWorkspaceSchema, client),
  })
}

export function getOrganizationMembersQueryOptions(
  filters: OrganizationMembersListFilters,
  client: FetchWithValidationOptions,
) {
  return queryOptions({
    queryKey: authQueryKeys.organizationMembers(filters),
    queryFn: () =>
      fetchWithValidation(
        withQueryParams("/auth/organization/list-members", filters),
        organizationMembersResponseSchema,
        client,
      ),
  })
}

export function getOrganizationInvitationsQueryOptions(
  filters: OrganizationInvitationsListFilters,
  client: FetchWithValidationOptions,
) {
  return queryOptions({
    queryKey: authQueryKeys.organizationInvitations(filters),
    queryFn: () =>
      fetchWithValidation(
        withQueryParams("/auth/organization/list-invitations", filters),
        organizationInvitationsResponseSchema,
        client,
      ),
  })
}

export function getServiceApiKeysQueryOptions(
  filters: ServiceApiKeysListFilters,
  client: FetchWithValidationOptions,
) {
  return queryOptions({
    queryKey: authQueryKeys.serviceApiKeys(filters),
    queryFn: () =>
      fetchWithValidation(
        withQueryParams("/auth/api-tokens", filters),
        serviceApiKeysResponseSchema,
        client,
      ),
  })
}
