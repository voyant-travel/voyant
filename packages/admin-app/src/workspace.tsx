import { Link, redirect, useRouterState } from "@tanstack/react-router"
import {
  type AdminExtension,
  AdminLocalePreferenceSync,
  type AdminNavLinkComponent,
  type AdminNavLinkProps,
  type AdminUser,
  getOperatorAdminMessageOverridesFromUiPrefs,
  OperatorAdminBootstrapGate,
  type OperatorAdminMessages,
  OperatorAdminMessagesProvider,
  type OperatorAdminNavigationIcons,
  OperatorAdminWorkspaceLayout,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
import { Loader2 } from "lucide-react"
import { forwardRef, type ReactNode, useMemo } from "react"

/**
 * Router-aware sidebar link. SidebarMenuButton with `asChild` wraps this in a
 * Slot, which clones the element with merged className, data attributes, and
 * event props — extras not declared on AdminNavLinkProps but arriving at runtime, so
 * spread the rest. Without this, Slot's className is silently dropped and
 * sidebar items render unstyled. External URLs fall back to a plain anchor.
 */
export const AdminRouterLink = forwardRef<HTMLAnchorElement, AdminNavLinkProps>(
  function AdminRouterLink({ children, href, onClick, target, ...rest }, ref) {
    const external = href.startsWith("http://") || href.startsWith("https://")

    if (external) {
      return (
        <a
          ref={ref}
          href={href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          onClick={onClick}
          {...rest}
        >
          {children}
        </a>
      )
    }

    return (
      <Link ref={ref} to={href} target={target} onClick={onClick} {...rest}>
        {children}
      </Link>
    )
  },
)

export interface CreateAdminWorkspaceBeforeLoadOptions<TUser> {
  /** Resolve the current user (server fn / cookie-forwarding fetch). */
  getCurrentUser: () => Promise<TUser | null | undefined>
  /** Where unauthenticated visitors are sent. Default `/sign-in`. */
  signInPath?: string
}

/**
 * The workspace auth guard. MUST run in `beforeLoad`, not `loader`:
 * beforeLoad executes top-down for the whole matched chain BEFORE any loader
 * fires, so an unauthenticated redirect short-circuits the subtree. In a
 * loader it would race child loaders whose 401s surface the root error
 * boundary and beat the redirect, dead-ending logged-out users. Returns
 * `{ user }`, which TanStack merges into route context.
 */
export function createAdminWorkspaceBeforeLoad<TUser>({
  getCurrentUser,
  signInPath = "/sign-in",
}: CreateAdminWorkspaceBeforeLoadOptions<TUser>) {
  return async ({ location }: { location: { href: string } }): Promise<{ user: TUser }> => {
    const user = await getCurrentUser()

    if (!user) {
      throw redirect({
        to: signInPath,
        search: { next: location.href },
      })
    }

    return { user }
  }
}

export function AdminWorkspacePendingFallback({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      </div>
    </div>
  )
}

/** Structural slice of the loaded user the shell itself needs. */
export interface AdminWorkspaceShellUser {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  profilePictureUrl?: string | null
  locale?: string | null
  timeZone?: string | null
  timezone?: string | null
  uiPrefs?: unknown
}

/** Default mapping from the loaded user to the layout's AdminUser shape. */
export function defaultAdminWorkspaceUser(user: AdminWorkspaceShellUser): AdminUser {
  return {
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email ?? "",
    avatar: user.profilePictureUrl,
    locale: user.locale,
    timeZone: user.timeZone ?? user.timezone,
  }
}

export interface AdminWorkspaceShellProps<TUser extends AdminWorkspaceShellUser> {
  user: TUser | null | undefined
  isUserLoading?: boolean
  /**
   * Admin extensions for the navigation/widget seam. Pass a function to
   * derive nav labels from the resolved admin messages.
   */
  extensions?:
    | ReadonlyArray<AdminExtension>
    | ((messages: OperatorAdminMessages) => ReadonlyArray<AdminExtension>)
  icons?: OperatorAdminNavigationIcons
  /** Defaults to the router-aware {@link AdminRouterLink}. */
  linkComponent?: AdminNavLinkComponent
  onSignOut?: () => void | Promise<void>
  /** Maps the loaded user for the layout; default covers the common fields. */
  mapUser?: (user: TUser) => AdminUser
  children: ReactNode
}

/**
 * The authenticated workspace shell: bootstrap gate (current-user readiness
 * is the only shell dependency), per-user message overrides, locale
 * preference sync, and the workspace layout with router-aware links — the
 * composition every Voyant admin previously copied from the template.
 */
export function AdminWorkspaceShell<TUser extends AdminWorkspaceShellUser>({
  user,
  isUserLoading,
  extensions,
  icons,
  linkComponent = AdminRouterLink,
  onSignOut,
  mapUser = defaultAdminWorkspaceUser,
  children,
}: AdminWorkspaceShellProps<TUser>) {
  const messages = useOperatorAdminMessages()

  return (
    <OperatorAdminBootstrapGate
      user={user}
      isUserLoading={isUserLoading}
      loadingFallback={<AdminWorkspacePendingFallback label={messages.loading} />}
    >
      {({ user: loadedUser }) => (
        <OperatorAdminMessagesProvider
          overrides={getOperatorAdminMessageOverridesFromUiPrefs(loadedUser.uiPrefs)}
        >
          <AdminLocalePreferenceSync source={loadedUser} />
          <AdminWorkspaceShellInner
            user={loadedUser}
            extensions={extensions}
            icons={icons}
            linkComponent={linkComponent}
            onSignOut={onSignOut}
            mapUser={mapUser}
          >
            {children}
          </AdminWorkspaceShellInner>
        </OperatorAdminMessagesProvider>
      )}
    </OperatorAdminBootstrapGate>
  )
}

function AdminWorkspaceShellInner<TUser extends AdminWorkspaceShellUser>({
  user,
  extensions,
  icons,
  linkComponent,
  onSignOut,
  mapUser,
  children,
}: {
  user: TUser
  extensions: AdminWorkspaceShellProps<TUser>["extensions"]
  icons?: OperatorAdminNavigationIcons
  linkComponent: AdminNavLinkComponent
  onSignOut?: () => void | Promise<void>
  mapUser: (user: TUser) => AdminUser
  children: ReactNode
}) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })
  const messages = useOperatorAdminMessages()
  const resolvedExtensions = useMemo(
    () => (typeof extensions === "function" ? extensions(messages) : extensions),
    [extensions, messages],
  )

  return (
    <OperatorAdminWorkspaceLayout
      currentPath={currentPath}
      extensions={resolvedExtensions}
      icons={icons}
      linkComponent={linkComponent}
      onSignOut={onSignOut}
      user={mapUser(user)}
    >
      {children}
    </OperatorAdminWorkspaceLayout>
  )
}
