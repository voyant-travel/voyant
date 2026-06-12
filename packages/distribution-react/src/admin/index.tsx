import { type AdminExtension, adminRoutePageModule, defineAdminExtension } from "@voyantjs/admin"

export interface CreateDistributionAdminExtensionOptions {
  /** Mount path of the channel-sync page inside the admin workspace. Default `/channel-sync`. */
  basePath?: string
  /** Localized page titles. Defaults are the English operator nav labels. */
  labels?: {
    channelSync?: string
  }
}

/**
 * The distribution admin contribution (packaged-admin RFC Phase 3,
 * `@voyantjs/<domain>-ui/admin` convention).
 *
 * NAVIGATION: deliberately none. The Channel sync nav item is part of the
 * BASE operator navigation — see `createOperatorAdminNavigation` in
 * `@voyantjs/admin` — so contributing a nav entry here would duplicate it.
 * If the base nav ever drops the item, this extension is where the entry
 * moves.
 *
 * ROUTES: one full implementation (packaged-admin RFC §4.8 endgame) — a lazy
 * `page` module loader for {@link ChannelSyncPage}, so hosts bind it through
 * their code-assembled admin route tree with no per-route file. The page
 * keeps its filter/tab state component-local and fetches client-side through
 * the shared `@voyantjs/react` provider context (`baseUrl` + credentialed
 * fetcher), so the contribution carries no loader, no search contract and no
 * SSR override. `adminRoutePageModule` adapts the page's all-optional props
 * bag past TypeScript's weak-type rule. No destination key is declared:
 * nothing navigates here semantically — the base nav links the path
 * directly.
 *
 * WIDGETS: none today. Per-booking sync state on the booking detail page is
 * that host's concern.
 */
export function createDistributionAdminExtension(
  options: CreateDistributionAdminExtensionOptions = {},
): AdminExtension {
  const { basePath = "/channel-sync", labels = {} } = options
  const { channelSync = "Channel sync" } = labels

  return defineAdminExtension({
    id: "distribution",
    routes: [
      {
        id: "distribution-channel-sync",
        path: basePath,
        title: channelSync,
        page: () =>
          import("../components/channel-sync-page.js").then((module) =>
            adminRoutePageModule(module.ChannelSyncPage),
          ),
      },
    ],
  })
}
