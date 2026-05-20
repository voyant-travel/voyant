import { queryOptions } from "@tanstack/react-query"
import {
  getActivitiesQueryOptions as getActivitiesQueryOptionsBase,
  getOpportunitiesQueryOptions as getOpportunitiesQueryOptionsBase,
  getOrganizationQueryOptions as getOrganizationQueryOptionsBase,
  getOrganizationsQueryOptions as getOrganizationsQueryOptionsBase,
  getPeopleQueryOptions as getPeopleQueryOptionsBase,
  getPersonActivitiesQueryOptions as getPersonActivitiesQueryOptionsBase,
  getPersonNotesQueryOptions as getPersonNotesQueryOptionsBase,
  getPersonOpportunitiesQueryOptions as getPersonOpportunitiesQueryOptionsBase,
  getPersonQueryOptions as getPersonQueryOptionsBase,
} from "@voyantjs/crm-react"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher (not defaultFetcher) so SSR loaders on these routes can
// forward the incoming request's cookie. Without this, direct loads of
// /people, /organizations, /people/$id, /organizations/$id 401 on the
// initial SSR pass.
const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export function getActivitiesQueryOptions(filters = {}) {
  return queryOptions(getActivitiesQueryOptionsBase(client, filters))
}

export function getOrganizationsQueryOptions(filters = {}) {
  return queryOptions(getOrganizationsQueryOptionsBase(client, filters))
}

export function getPeopleQueryOptions(filters = {}) {
  return queryOptions(getPeopleQueryOptionsBase(client, filters))
}

export function getPersonQueryOptions(id: string) {
  return queryOptions(getPersonQueryOptionsBase(client, id))
}

export function getPersonNotesQueryOptions(id: string) {
  return queryOptions(getPersonNotesQueryOptionsBase(client, id))
}

export function getPersonActivitiesQueryOptions(id: string) {
  return queryOptions(getPersonActivitiesQueryOptionsBase(client, id))
}

export function getPersonOpportunitiesQueryOptions(id: string) {
  return queryOptions(getPersonOpportunitiesQueryOptionsBase(client, id))
}

export function getOrganizationQueryOptions(id: string) {
  return queryOptions(getOrganizationQueryOptionsBase(client, id))
}

export function getOpportunitiesQueryOptions(filters = {}) {
  return queryOptions(getOpportunitiesQueryOptionsBase(client, filters))
}
