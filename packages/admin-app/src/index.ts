export type {
  AdminCoreAccountOptions,
  AdminCoreDashboardOptions,
  AdminCoreSettingsExtraPage,
  AdminCoreSettingsOptions,
  AdminCoreSettingsPageId,
  CreateAdminCoreExtensionOptions,
} from "./core-extension/index.js"
export { createAdminCoreExtension } from "./core-extension/index.js"
export type {
  AdminExtensionChildRoutesOptions,
  AdminExtensionRouteLoaderArgs,
  AdminExtensionRouteOptions,
  AdminExtensionRouteRuntime,
} from "./extension-routes.js"
export {
  adminExtensionChildRoutes,
  adminExtensionRouteOptions,
  attachAdminExtensionRoutes,
} from "./extension-routes.js"
export type { AdminRootErrorBoundaryProps, AdminRootHeadOptions } from "./root.js"
export { AdminRootErrorBoundary, AdminRootShell, adminRootHead } from "./root.js"
export type { AdminRouterContext, CreateAdminRouterOptions } from "./router.js"
export { AdminNotFound, createAdminQueryClient, createAdminRouter } from "./router.js"
export type {
  AdminWorkspaceShellProps,
  AdminWorkspaceShellUser,
  CreateAdminWorkspaceBeforeLoadOptions,
} from "./workspace.js"
export {
  AdminRouterLink,
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
  defaultAdminWorkspaceUser,
} from "./workspace.js"
