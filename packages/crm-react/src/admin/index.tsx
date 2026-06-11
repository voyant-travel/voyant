import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminRouteRuntime,
  adminRoutePageModule,
  defineAdminExtension,
} from "@voyantjs/admin"

import {
  defaultFetcher,
  getActivitiesQueryOptions,
  getOrganizationQueryOptions,
  getOrganizationsQueryOptions,
  getPeopleQueryOptions,
  getPersonQueryOptions,
  getQuotesQueryOptions,
} from "../index.js"
import { OrganizationDetailSkeleton } from "./organization-detail-skeleton.js"
import { OrganizationsListSkeleton } from "./organizations-list-skeleton.js"
import { PeopleListSkeleton } from "./people-list-skeleton.js"
import { PersonDetailSkeleton } from "./person-detail-skeleton.js"

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
 * ROUTES: contributions carry the FULL route implementation (packaged-admin
 * RFC §4.2/§4.8) — lazy `page` module loaders, data loaders fed by the
 * host-supplied {@link AdminRouteLoaderContext} (QueryClient + runtime +
 * params), per-route SSR mode, and pending skeletons. Hosts bind them into
 * their code-assembled admin route tree; no per-route host files needed.
 * The pages stay code-split because each contribution's `page` dynamically
 * imports the specific host/page module — never the admin barrel — so the
 * heavy page chunks load on navigation, not with workspace chrome. The
 * detail pages read the route id from {@link AdminRoutePageProps} via the
 * default-exported wrappers in `./pages/`. The lists carry no URL search
 * state (filtering/paging is in-memory component state), so no
 * `validateSearch` contracts.
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
        ssr: "data-only",
        page: () =>
          import("./people-host.js").then((module) => adminRoutePageModule(module.PeopleHost)),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getPeopleQueryOptions(loaderClient(runtime), { limit: 25, offset: 0 }),
          ),
        pendingComponent: PeopleListSkeleton,
      },
      {
        id: "crm-people-detail",
        path: `${peopleBasePath}/$id`,
        title: people,
        page: () => import("./pages/person-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = loaderClient(runtime)
          const person = await queryClient.ensureQueryData(getPersonQueryOptions(client, id))

          if (person.organizationId) {
            await queryClient.ensureQueryData(
              getOrganizationQueryOptions(client, person.organizationId),
            )
          }
        },
        pendingComponent: PersonDetailSkeleton,
      },
      {
        id: "crm-organizations-index",
        path: organizationsBasePath,
        title: organizations,
        ssr: "data-only",
        page: () =>
          import("./organizations-host.js").then((module) =>
            adminRoutePageModule(module.OrganizationsHost),
          ),
        loader: ({ queryClient, runtime }: AdminRouteLoaderContext) =>
          queryClient.ensureQueryData(
            getOrganizationsQueryOptions(loaderClient(runtime), { limit: 25, offset: 0 }),
          ),
        pendingComponent: OrganizationsListSkeleton,
      },
      {
        id: "crm-organizations-detail",
        path: `${organizationsBasePath}/$id`,
        title: organizations,
        page: () => import("./pages/organization-detail-page.js"),
        loader: async ({ queryClient, runtime, params }: AdminRouteLoaderContext) => {
          const id = params.id
          if (!id) return
          const client = loaderClient(runtime)

          await Promise.all([
            queryClient.ensureQueryData(getOrganizationQueryOptions(client, id)),
            queryClient.ensureQueryData(
              getPeopleQueryOptions(client, { organizationId: id, limit: 50 }),
            ),
            queryClient.ensureQueryData(
              getQuotesQueryOptions(client, { organizationId: id, limit: 50 }),
            ),
            queryClient.ensureQueryData(
              getActivitiesQueryOptions(client, {
                entityType: "organization",
                entityId: id,
                limit: 50,
              }),
            ),
          ])
        },
        pendingComponent: OrganizationDetailSkeleton,
      },
    ],
  })
}

/**
 * Bridge the host-supplied {@link AdminRouteRuntime} (optional fetcher) to
 * the required-fetcher client contract the CRM query options take.
 */
function loaderClient(runtime: AdminRouteRuntime) {
  return { baseUrl: runtime.baseUrl, fetcher: runtime.fetcher ?? defaultFetcher }
}
