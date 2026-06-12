import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyantjs/admin"
// Type-only: binds the bookings-ui `AdminDestinations` augmentation
// (`booking.detail`, `person.detail`, `organization.detail`, ...) into this
// program — the contract detail page's reference cells navigate through
// those shared keys, and `booking.detail`'s shape carries bookings-ui's own
// tab union, so re-declaring it here could not stay shape-identical.
import type {} from "@voyantjs/bookings-react/admin"

import {
  defaultFetcher,
  type FetchWithValidationOptions,
  getLegalContractAttachmentsQueryOptions,
  getLegalContractNumberSeriesQueryOptions,
  getLegalContractQueryOptions,
  getLegalContractSignaturesQueryOptions,
  getLegalContractsQueryOptions,
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplatesQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
  getLegalPoliciesQueryOptions,
  getLegalPolicyAcceptancesQueryOptions,
  getLegalPolicyAssignmentsQueryOptions,
  getLegalPolicyQueryOptions,
  getLegalPolicyVersionsQueryOptions,
} from "../index.js"

/**
 * Semantic destinations the legal admin surfaces navigate to
 * (packaged-admin RFC §4.7). Keys shared with other domains
 * (`person.detail`, `booking.detail`) come from the bookings-ui
 * augmentation bound above; declared here are the legal-owned targets the
 * packaged pages and breadcrumbs resolve through
 * `useAdminHref`/`useAdminNavigate`.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The legal area's landing surface (redirects to contracts). */
    "legal.home": Record<string, never>
    /** The contracts list page. */
    "contract.list": Record<string, never>
    /** A contract's detail page. */
    "contract.detail": { contractId: string }
    /** The contract templates list page. */
    "contractTemplate.list": Record<string, never>
    /** A contract template's detail page. */
    "contractTemplate.detail": { templateId: string }
    /** The policies list page. */
    "policy.list": Record<string, never>
    /** A policy's detail page. */
    "policy.detail": { policyId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the operator-grade
// legal pages bound to their data wiring + semantic-destination navigation.
// Host route files only bind route params onto these.
export {
  ContractDetailHost,
  type ContractDetailHostProps,
} from "./contract-detail-host.js"
export { ContractDialog, type ContractDialogProps } from "./contract-dialog.js"
export { ContractsHost } from "./contracts-host.js"
export { NumberSeriesDialog } from "./number-series-dialog.js"
export { NumberSeriesHost } from "./number-series-host.js"
export { PoliciesHost } from "./policies-host.js"
export {
  type AssignmentData,
  PolicyAssignmentDialog,
  type PolicyAssignmentDialogProps,
} from "./policy-assignment-dialog.js"
export { PolicyDetailHost, type PolicyDetailHostProps } from "./policy-detail-host.js"
export { PolicyDialog } from "./policy-dialog.js"
export { TemplateDetailHost, type TemplateDetailHostProps } from "./template-detail-host.js"
export { TemplateDialog } from "./template-dialog.js"
export { TemplateVersionDialog } from "./template-version-dialog.js"
export { TemplatesHost } from "./templates-host.js"

/**
 * Bind the host-supplied route runtime to the legal data-client shape the
 * query-option factories take. Hosts that don't inject a fetcher (no SSR
 * cookie forwarding) fall back to the package's `defaultFetcher`.
 */
function toLegalClient(runtime: AdminRouteRuntime): FetchWithValidationOptions {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}

export interface CreateLegalAdminExtensionOptions {
  /** Mount path of the legal pages inside the admin workspace. Default `/legal`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    contracts?: string
    contractTemplates?: string
    policies?: string
    numberSeries?: string
  }
}

/**
 * The legal admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Legal nav group (contracts, contract
 * templates, policies, number series) is part of the BASE operator
 * navigation — see `createOperatorAdminNavigation` in `@voyantjs/admin` —
 * so contributing nav entries here would duplicate them. If the base nav
 * ever drops the legal group, this extension is where the entries move.
 *
 * ROUTES: full implementations (packaged-admin RFC §4.8 endgame) — each
 * contribution carries the lazy `page` module loader, the data loader and
 * the per-route SSR mode, so hosts bind them through their code-assembled
 * admin route tree with no per-route files. List pages
 * ({@link ContractsHost}, {@link TemplatesHost}, {@link PoliciesHost},
 * {@link NumberSeriesHost}) are zero-prop; the detail contributions resolve
 * wrapper pages (`./pages/*`) that bind the matched `$id` param onto
 * {@link ContractDetailHost}, {@link TemplateDetailHost} and
 * {@link PolicyDetailHost}. Pages stay code-split because every `page` is a
 * dynamic import of the specific host module, never a static reference from
 * this factory.
 *
 * WIDGETS: none today. The legal-owned `BookingContractCard` ships from the
 * package root, but no operator surface currently mounts it through a
 * widget slot — the booking detail page's documents/contract wiring is an
 * operator bookings-domain concern and stays with that host.
 */
export function createLegalAdminExtension(
  options: CreateLegalAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/legal", labels = {} } = options
  const {
    contracts = "Contracts",
    contractTemplates = "Contract Templates",
    policies = "Policies",
    numberSeries = "Number Series",
  } = labels

  return defineAdminExtension({
    id: "legal",
    routes: [
      {
        id: "legal-contracts-index",
        path: `${basePath}/contracts`,
        title: contracts,
        ssr: "data-only",
        page: () =>
          import("./contracts-host.js").then((module) =>
            adminRoutePageModule(module.ContractsHost),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getLegalContractsQueryOptions(toLegalClient(runtime), {
              search: "",
              scope: "all",
              status: "all",
              limit: 25,
              offset: 0,
            }),
          ),
      },
      {
        id: "legal-contracts-detail",
        path: `${basePath}/contracts/$id`,
        title: contracts,
        ssr: "data-only",
        page: () => import("./pages/contract-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = toLegalClient(runtime)

          await queryClient.ensureQueryData(getLegalContractQueryOptions(client, id))

          void queryClient.prefetchQuery(
            getLegalContractSignaturesQueryOptions(client, { contractId: id }),
          )
          void queryClient.prefetchQuery(
            getLegalContractAttachmentsQueryOptions(client, { contractId: id }),
          )
        },
      },
      {
        id: "legal-templates-index",
        path: `${basePath}/templates`,
        title: contractTemplates,
        ssr: "data-only",
        page: () =>
          import("./templates-host.js").then((module) =>
            adminRoutePageModule(module.TemplatesHost),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getLegalContractTemplatesQueryOptions(toLegalClient(runtime), {
              search: "",
              scope: "all",
            }),
          ),
      },
      {
        id: "legal-templates-detail",
        path: `${basePath}/templates/$id`,
        title: contractTemplates,
        ssr: "data-only",
        page: () => import("./pages/template-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = toLegalClient(runtime)

          await queryClient.ensureQueryData(getLegalContractTemplateQueryOptions(client, id))

          void queryClient.prefetchQuery(
            getLegalContractTemplateVersionsQueryOptions(client, { templateId: id }),
          )
        },
      },
      {
        id: "legal-policies-index",
        path: `${basePath}/policies`,
        title: policies,
        ssr: "data-only",
        page: () =>
          import("./policies-host.js").then((module) => adminRoutePageModule(module.PoliciesHost)),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getLegalPoliciesQueryOptions(toLegalClient(runtime), {
              search: "",
              kind: "all",
              limit: 25,
              offset: 0,
            }),
          ),
      },
      {
        id: "legal-policies-detail",
        path: `${basePath}/policies/$id`,
        title: policies,
        ssr: "data-only",
        page: () => import("./pages/policy-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = toLegalClient(runtime)

          await queryClient.ensureQueryData(getLegalPolicyQueryOptions(client, id))

          void queryClient.prefetchQuery(
            getLegalPolicyVersionsQueryOptions(client, { policyId: id }),
          )
          void queryClient.prefetchQuery(
            getLegalPolicyAssignmentsQueryOptions(client, { policyId: id }),
          )
          void queryClient.prefetchQuery(
            getLegalPolicyAcceptancesQueryOptions(client, { limit: 50, offset: 0 }),
          )
        },
      },
      {
        id: "legal-number-series",
        path: `${basePath}/number-series`,
        title: numberSeries,
        ssr: "data-only",
        page: () =>
          import("./number-series-host.js").then((module) =>
            adminRoutePageModule(module.NumberSeriesHost),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getLegalContractNumberSeriesQueryOptions(toLegalClient(runtime)),
          ),
      },
    ],
  })
}
