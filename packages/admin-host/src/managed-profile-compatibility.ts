/** @deprecated Import the profile-agnostic admin host APIs from the package root. */
export type { ServeAdminHostOptions as ServeManagedProfileAdminOptions } from "./serve.js"
/** @deprecated Use serveAdminHost. */
export { serveAdminHost as serveManagedProfileAdmin } from "./serve.js"
/** @deprecated Use AdminSsrHandler. */
export type { AdminSsrHandler as ManagedProfileAdminSsrHandler } from "./ssr.js"
/** @deprecated Use createAdminSsrHandler. */
export { createAdminSsrHandler as createManagedProfileAdminSsrHandler } from "./ssr.js"
