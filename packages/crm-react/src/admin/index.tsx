import { type AdminExtension, defineAdminExtension } from "@voyantjs/admin"

/**
 * Semantic destinations the CRM admin surfaces navigate to (packaged-admin
 * RFC §4.7). The people/organization pages link into routes they do not own,
 * so they resolve these keys through `useAdminHref`/`useAdminNavigate` from
 * `@voyantjs/admin`; hosts register one resolver per key
 * (`satisfies AdminDestinationResolvers`).
 *
 * `person.detail` and `organization.detail` are ALSO declared by
 * `@voyantjs/bookings-react/admin` (its pages were their first consumers).
 * This package cannot peer-depend on bookings-ui — bookings-ui depends on
 * crm-ui — so the keys are re-declared here shape-locked: interface merging
 * requires the member shape to stay identical across packages.
 */
declare module "@voyantjs/admin" {
  interface AdminDestinations {
    /** The CRM people list page. */
    "person.list": Record<string, never>
    /** A CRM person's detail page. */
    "person.detail": { personId: string }
    /** The CRM organizations list page. */
    "organization.list": Record<string, never>
    /** A CRM organization's detail page. */
    "organization.detail": { organizationId: string }
  }
}

// Packaged admin hosts (packaged-admin RFC Phase 3): the CRM pages bound to
// their data wiring + semantic-destination navigation. Host route files only
// bind route params onto these.
export {
  OrganizationDetailHost,
  type OrganizationDetailHostProps,
} from "./organization-detail-host.js"
export { OrganizationDetailSkeleton } from "./organization-detail-skeleton.js"
export { OrganizationsHost } from "./organizations-host.js"
export { OrganizationsListSkeleton } from "./organizations-list-skeleton.js"
export { PeopleHost } from "./people-host.js"
export { PeopleListSkeleton } from "./people-list-skeleton.js"
export {
  type PersonDetailBookingsTabContext,
  PersonDetailHost,
  type PersonDetailHostProps,
  personDetailBookingsTabSlot,
} from "./person-detail-host.js"
export { PersonDetailSkeleton } from "./person-detail-skeleton.js"

export interface CreateCrmAdminExtensionOptions {
  /** Mount path of the people pages inside the admin workspace. Default `/people`. */
  peopleBasePath?: string
  /** Mount path of the organization pages inside the admin workspace. Default `/organizations`. */
  organizationsBasePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    people?: string
    organizations?: string
  }
}

/**
 * The CRM admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The People and Organizations nav items are
 * part of the BASE operator navigation — see `createOperatorAdminNavigation`
 * in `@voyantjs/admin` — so contributing nav entries here would duplicate
 * them. If the base nav ever drops those items, this extension is where the
 * entries move.
 *
 * ROUTES: contributions are metadata only — the CRM pages carry no URL
 * search state (list filtering/paging is in-memory component state). The
 * PAGES are package-owned: {@link PeopleHost} and {@link OrganizationsHost}
 * are zero-prop hosts route files can mount directly via `component:` on the
 * file route; {@link PersonDetailHost} and {@link OrganizationDetailHost}
 * take the record id as a prop, so their host route files stay the thin
 * binding layer (`Route.useParams()` → host props) until the §4.2 code-based
 * route assembly gives packaged pages a router-agnostic way to read route
 * state. `component:` is intentionally NOT attached to the contributions
 * themselves yet for the same reason.
 *
 * WIDGET SLOTS: the person detail page exposes
 * {@link personDetailBookingsTabSlot} — the bookings-ui ↔ crm-ui cycle
 * resolution (RFC §4.7). `@voyantjs/bookings-react/ui` depends on this package, so
 * the person page cannot import the bookings-owned person-bookings card;
 * instead bookings-ui's admin extension contributes a widget targeting that
 * slot and {@link PersonDetailHost} mounts its Bookings tab whenever a
 * contribution exists.
 */
export function createCrmAdminExtension(
  options: CreateCrmAdminExtensionOptions = {},
): AdminExtension {
  const {
    peopleBasePath = "/people",
    organizationsBasePath = "/organizations",
    labels = {},
  } = options
  const { people = "People", organizations = "Organizations" } = labels

  return defineAdminExtension({
    id: "crm",
    routes: [
      {
        id: "crm-people-index",
        path: peopleBasePath,
        title: people,
      },
      {
        id: "crm-people-detail",
        path: `${peopleBasePath}/$id`,
        title: people,
      },
      {
        id: "crm-organizations-index",
        path: organizationsBasePath,
        title: organizations,
      },
      {
        id: "crm-organizations-detail",
        path: `${organizationsBasePath}/$id`,
        title: organizations,
      },
    ],
  })
}
