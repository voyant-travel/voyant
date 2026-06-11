import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"
// Type-only: binds the bookings-ui `AdminDestinations` augmentation
// (`booking.detail`, `person.detail`, `organization.detail`, ...) into this
// program — the contract detail page's reference cells navigate through
// those shared keys, and `booking.detail`'s shape carries bookings-ui's own
// tab union, so re-declaring it here could not stay shape-identical.
import type {} from "@voyantjs/bookings-react/admin"

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
 * ROUTES: contributions are metadata only — the legal pages keep their
 * filter state component-local, so there are no URL search contracts. The
 * PAGES are package-owned: {@link ContractsHost}, {@link PoliciesHost},
 * {@link TemplatesHost} and {@link NumberSeriesHost} are zero-prop;
 * {@link ContractDetailHost}, {@link PolicyDetailHost} and
 * {@link TemplateDetailHost} bind the operator-grade detail pages to their
 * data wiring and resolve every cross-route link through the semantic
 * destinations declared above. `component:` is intentionally NOT attached
 * to these contributions yet: the contribution contract renders zero-prop
 * pages (route components read params via the router, per RFC §4.2), while
 * the detail hosts take the record id as a prop. Host route files stay the
 * thin binding layer (`Route.useParams()` → host props) until the §4.2
 * code-based route assembly gives packaged pages a router-agnostic way to
 * read route state.
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
      },
      {
        id: "legal-contracts-detail",
        path: `${basePath}/contracts/$id`,
        title: contracts,
      },
      {
        id: "legal-templates-index",
        path: `${basePath}/templates`,
        title: contractTemplates,
      },
      {
        id: "legal-templates-detail",
        path: `${basePath}/templates/$id`,
        title: contractTemplates,
      },
      {
        id: "legal-policies-index",
        path: `${basePath}/policies`,
        title: policies,
      },
      {
        id: "legal-policies-detail",
        path: `${basePath}/policies/$id`,
        title: policies,
      },
      {
        id: "legal-number-series",
        path: `${basePath}/number-series`,
        title: numberSeries,
      },
    ],
  })
}
