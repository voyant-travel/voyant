export type { AuthStatus, CurrentUser } from "@voyant-travel/auth/workspace"
export {
  createAuthBasePathFetcher,
  defaultFetcher,
  fetchWithValidation,
  VoyantApiError,
  type VoyantFetcher,
  withQueryParams,
} from "./client.js"
export * from "./components/team-management-page.js"
export * from "./hooks/index.js"
export {
  useVoyantAuthContext,
  type VoyantAuthContextValue,
  VoyantAuthProvider,
  type VoyantAuthProviderProps,
} from "./provider.js"
export {
  authQueryKeys,
  type OrganizationInvitationsListFilters,
  type OrganizationMembersListFilters,
  type ServiceApiKeysListFilters,
} from "./query-keys.js"
export {
  getAuthStatusQueryOptions,
  getCurrentUserQueryOptions,
  getCurrentWorkspaceQueryOptions,
  getOrganizationInvitationsQueryOptions,
  getOrganizationMembersQueryOptions,
  getServiceApiKeysQueryOptions,
} from "./query-options.js"
export * from "./schemas.js"
