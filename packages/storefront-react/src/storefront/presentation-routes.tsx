"use client"

import { Outlet, redirect, useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components/card"
import type { ComponentType, ReactNode } from "react"
import { z } from "zod"
import type { VoyantFetcher } from "../customer-portal/client.js"
import { getStorefrontCustomerProductDetailRoute } from "../routing.js"
import { StorefrontBrowsePage, shopSearchSchema } from "./browse-page.js"
import { type StorefrontConfirmationKind, StorefrontConfirmationPage } from "./confirmation-page.js"
import { type StorefrontUiNavigation, StorefrontUiProvider } from "./context.js"
import { CustomerAccountPage } from "./customer-account-page.js"
import { CustomerAccountProvider } from "./customer-account-provider.js"
import {
  CustomerSignInPage,
  CustomerSignUpPage,
  CustomerVerifyEmailPage,
} from "./customer-auth-pages.js"
import {
  type StorefrontMessages,
  StorefrontMessagesProvider,
  useStorefrontMessagesOrDefault,
} from "./messages.js"
import { StorefrontScopeProvider, useStorefrontScope } from "./scope.js"
import { StorefrontShell } from "./shell.js"

const accountSignInSearchSchema = z.object({
  next: z.string().optional(),
  verify: z.string().optional(),
})

const accountSignUpSearchSchema = z.object({
  next: z.string().optional(),
})

const accountVerifyEmailSearchSchema = z.object({
  email: z.string().optional(),
  next: z.string().optional(),
})

const confirmationSearchSchema = z.object({
  kind: z.enum(["card_pending", "bank_transfer", "inquiry", "hold"]).optional(),
  session: z.string().optional(),
  orderId: z.string().optional(),
  ref: z.string().optional(),
})

export interface StorefrontPresentationSession {
  readonly data: unknown
  readonly isPending: boolean
}

export interface StorefrontBookingRouteProps {
  entityModule: string
  entityId: string
  messages: StorefrontMessages["bookingJourney"]
  search: unknown
}

export interface StorefrontComposerRouteProps {
  apiUrl: string
  gateMessages: StorefrontMessages["composer"]
  signedIn: boolean
}

export interface StorefrontPresentationRuntime {
  readonly BookingPage: ComponentType<StorefrontBookingRouteProps>
  readonly ComposerPage: ComponentType<StorefrontComposerRouteProps>
  getApiUrl(): string
  projectFetcher: VoyantFetcher
  renderProductDetail(entityModule: string, entityId: string): ReactNode
  resendVerification(email: string): Promise<unknown>
  signOut(): Promise<unknown>
  useLocale(): string
  useSession(): StorefrontPresentationSession
  bookingSearchSchema: z.ZodType
}

export interface StorefrontPresentationRouteOptions {
  readonly component: () => ReactNode
  readonly beforeLoad?: (input: { params: { entityModule: string; entityId: string } }) => void
  readonly validateSearch?: z.ZodType
}

export interface StorefrontPresentationContribution {
  readonly id: "@voyant-travel/storefront#presentation.customer"
  readonly routes: {
    readonly layout: StorefrontPresentationRouteOptions
    readonly shop: StorefrontPresentationRouteOptions
    readonly account: StorefrontPresentationRouteOptions
    readonly accountSignIn: StorefrontPresentationRouteOptions
    readonly accountSignUp: StorefrontPresentationRouteOptions
    readonly accountVerifyEmail: StorefrontPresentationRouteOptions
    readonly booking: StorefrontPresentationRouteOptions
    readonly composer: StorefrontPresentationRouteOptions
    readonly confirmation: StorefrontPresentationRouteOptions
    readonly productDetail: StorefrontPresentationRouteOptions
  }
}

/** Package-owned customer presentation selected with the Storefront graph unit. */
export function createStorefrontPresentationContribution(
  runtime: StorefrontPresentationRuntime,
): StorefrontPresentationContribution {
  function LayoutRoute(): React.ReactElement {
    return (
      <StorefrontMessagesProvider locale={runtime.useLocale()}>
        <StorefrontScopeProvider>
          <CustomerAccountProvider baseUrl={runtime.getApiUrl()} fetcher={runtime.projectFetcher}>
            <StorefrontChrome />
          </CustomerAccountProvider>
        </StorefrontScopeProvider>
      </StorefrontMessagesProvider>
    )
  }

  function StorefrontChrome(): React.ReactElement {
    const { data: session, isPending } = runtime.useSession()
    return (
      <StorefrontShell signedIn={Boolean(session)} sessionPending={isPending}>
        <Outlet />
      </StorefrontShell>
    )
  }

  function ShopRoute(): React.ReactElement {
    const messages = useStorefrontMessagesOrDefault()
    const scope = useStorefrontScope()
    const navigate = useNavigate()
    const search = useSearch({ strict: false }) as z.infer<typeof shopSearchSchema>
    return (
      <StorefrontUiProvider
        value={{
          apiUrl: runtime.getApiUrl(),
          messages,
          scope,
          navigate: (navigation: StorefrontUiNavigation) => void navigate(navigation as never),
        }}
      >
        <StorefrontBrowsePage search={search} />
      </StorefrontUiProvider>
    )
  }

  function AccountSignInRoute(): React.ReactElement | null {
    const navigate = useNavigate()
    const { next, verify } = useSearch({ strict: false }) as z.infer<
      typeof accountSignInSearchSchema
    >
    const { data: session, isPending } = runtime.useSession()
    const redirectTo = next || "/shop/account"
    if (isPending) return null
    if (session) {
      void navigate({ to: redirectTo })
      return null
    }
    return (
      <CustomerSignInPage
        redirectTo={redirectTo}
        verified={Boolean(verify)}
        onNavigate={(to) => void navigate({ to })}
      />
    )
  }

  function AccountSignUpRoute(): React.ReactElement | null {
    const navigate = useNavigate()
    const { next } = useSearch({ strict: false }) as z.infer<typeof accountSignUpSearchSchema>
    const { data: session, isPending } = runtime.useSession()
    const redirectTo = next || "/shop/account"
    if (isPending) return null
    if (session) {
      void navigate({ to: redirectTo })
      return null
    }
    return (
      <CustomerSignUpPage
        redirectTo={redirectTo}
        onNavigateToVerify={(email) =>
          void navigate({
            to: "/shop/account/verify-email",
            search: { email, next: redirectTo },
          })
        }
      />
    )
  }

  function AccountRoute(): React.ReactElement | null {
    const navigate = useNavigate()
    const { data: session, isPending } = runtime.useSession()
    if (isPending) return null
    if (!session) {
      void navigate({ to: "/shop/account/sign-in", search: { next: "/shop/account" } })
      return null
    }
    return (
      <CustomerAccountPage
        onSignOut={async () => {
          await runtime.signOut()
          void navigate({ to: "/shop" })
        }}
      />
    )
  }

  function AccountVerifyEmailRoute(): React.ReactElement {
    const navigate = useNavigate()
    const { email, next } = useSearch({ strict: false }) as z.infer<
      typeof accountVerifyEmailSearchSchema
    >
    const redirectTo = next || "/shop/account"
    return (
      <CustomerVerifyEmailPage
        email={email}
        redirectTo={redirectTo}
        onCompleted={async () => {
          await runtime.signOut()
        }}
        onResendVerification={runtime.resendVerification}
        onNavigateToSignIn={() =>
          void navigate({
            to: "/shop/account/sign-in",
            search: { next: redirectTo, verify: "1" },
          })
        }
      />
    )
  }

  function BookingRoute(): React.ReactElement {
    const { entityModule, entityId } = useParams({ strict: false }) as {
      entityModule: string
      entityId: string
    }
    const search = useSearch({ strict: false })
    const messages = useStorefrontMessagesOrDefault()
    const scope = useStorefrontScope()
    const navigate = useNavigate()
    return (
      <StorefrontUiProvider
        value={{
          apiUrl: runtime.getApiUrl(),
          messages,
          scope,
          navigate: (navigation: StorefrontUiNavigation) => void navigate(navigation as never),
        }}
      >
        <runtime.BookingPage
          entityModule={entityModule}
          entityId={entityId}
          messages={messages.bookingJourney}
          search={search}
        />
      </StorefrontUiProvider>
    )
  }

  function ComposerRoute(): React.ReactElement | null {
    const { data: session, isPending } = runtime.useSession()
    const messages = useStorefrontMessagesOrDefault()
    if (isPending) return null
    return (
      <runtime.ComposerPage
        apiUrl={runtime.getApiUrl()}
        gateMessages={messages.composer}
        signedIn={Boolean(session)}
      />
    )
  }

  function ConfirmationRoute(): React.ReactElement {
    const { bookingId } = useParams({ strict: false }) as { bookingId: string }
    const search = useSearch({ strict: false }) as z.infer<typeof confirmationSearchSchema>
    return (
      <StorefrontConfirmationPage
        apiUrl={runtime.getApiUrl()}
        bookingId={bookingId}
        kind={search.kind as StorefrontConfirmationKind | undefined}
        paymentRef={search.session ?? search.orderId ?? search.ref}
      />
    )
  }

  function ProductDetailRoute(): React.ReactElement {
    const { entityModule, entityId } = useParams({ strict: false }) as {
      entityModule: string
      entityId: string
    }
    const messages = useStorefrontMessagesOrDefault()
    const scope = useStorefrontScope()
    const navigate = useNavigate()
    const t = messages.shop
    if (!getStorefrontCustomerProductDetailRoute(entityModule, entityId)) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{t.nonBookableTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {t.nonBookableBody.replace("{vertical}", formatVerticalLabel(entityModule, t))}
          </CardContent>
        </Card>
      )
    }
    return (
      <StorefrontUiProvider
        value={{
          apiUrl: runtime.getApiUrl(),
          messages,
          scope,
          navigate: (navigation: StorefrontUiNavigation) => void navigate(navigation as never),
        }}
      >
        {runtime.renderProductDetail(entityModule, entityId)}
      </StorefrontUiProvider>
    )
  }

  return {
    id: "@voyant-travel/storefront#presentation.customer",
    routes: {
      layout: { component: LayoutRoute },
      shop: { component: ShopRoute, validateSearch: shopSearchSchema },
      account: { component: AccountRoute },
      accountSignIn: {
        component: AccountSignInRoute,
        validateSearch: accountSignInSearchSchema,
      },
      accountSignUp: {
        component: AccountSignUpRoute,
        validateSearch: accountSignUpSearchSchema,
      },
      accountVerifyEmail: {
        component: AccountVerifyEmailRoute,
        validateSearch: accountVerifyEmailSearchSchema,
      },
      booking: {
        beforeLoad: ({ params }) => {
          if (!getStorefrontCustomerProductDetailRoute(params.entityModule, params.entityId)) {
            throw redirect({ to: "/shop" })
          }
        },
        component: BookingRoute,
        validateSearch: runtime.bookingSearchSchema,
      },
      composer: { component: ComposerRoute },
      confirmation: {
        component: ConfirmationRoute,
        validateSearch: confirmationSearchSchema,
      },
      productDetail: { component: ProductDetailRoute },
    },
  }
}

export function createStorefrontMessagesProvider(useLocale: () => string) {
  return function SelectedStorefrontMessagesProvider({ children }: { children: ReactNode }) {
    return <StorefrontMessagesProvider locale={useLocale()}>{children}</StorefrontMessagesProvider>
  }
}

function formatVerticalLabel(vertical: string, messages: Record<string, string>): string {
  if (vertical === "products") return messages.verticalProducts
  if (vertical === "cruises") return messages.verticalCruises
  if (vertical === "accommodations") return messages.verticalAccommodations
  if (vertical === "charters") return messages.verticalCharters
  return vertical
}
