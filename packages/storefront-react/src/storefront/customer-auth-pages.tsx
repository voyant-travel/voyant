import {
  SignInPage,
  type SignInPageMessages,
  SignUpPage,
  type SignUpPageMessages,
  VerifyEmailPage,
  type VerifyEmailPageMessages,
} from "@voyant-travel/auth-react/ui"
import { buttonVariants } from "@voyant-travel/ui/components/button"
import { useCustomerPortalMutation } from "../customer-portal/hooks/index.js"

const signInMessages: Partial<SignInPageMessages> = {
  title: "Sign in to your travel account",
  description: "Access your profile, saved travelers, documents, and bookings.",
  emailPlaceholder: "you@example.com",
  submit: "Sign in",
  signingIn: "Signing in",
}

const signUpMessages: Partial<SignUpPageMessages> = {
  title: "Create your travel account",
  description: "Save traveler details and manage bookings without using the operator workspace.",
  nameLabel: "Full name",
  emailPlaceholder: "you@example.com",
  submit: "Create account",
  signingUp: "Creating account",
}

const verifyEmailMessages: Partial<VerifyEmailPageMessages> = {
  title: "Verify your email",
  description: "Enter the verification code we sent before signing in.",
  successTitle: "Email verified",
  successDescription: "Your travel account is ready.",
}

export function CustomerSignInPage({
  onNavigate,
  redirectTo,
  verified = false,
}: {
  onNavigate: (to: string) => void
  redirectTo: string
  verified?: boolean
}): React.ReactElement {
  const customerPortal = useCustomerPortalMutation()
  return (
    <div className="mx-auto max-w-md py-10">
      {verified ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-900 text-sm">
          Email verified. Sign in to continue.
        </div>
      ) : null}
      <SignInPage
        redirectTo={redirectTo}
        signUpHref={`/shop/account/sign-up?next=${encodeURIComponent(redirectTo)}`}
        messages={signInMessages}
        onSignedIn={async () => {
          await customerPortal.bootstrap.mutateAsync({ createCustomerIfMissing: true })
          onNavigate(redirectTo)
        }}
      />
      <StorefrontBackLink />
    </div>
  )
}

export function CustomerSignUpPage({
  onNavigateToVerify,
  redirectTo,
}: {
  onNavigateToVerify: (email: string) => void
  redirectTo: string
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-md py-10">
      <SignUpPage
        redirectTo={redirectTo}
        signInHref={`/shop/account/sign-in?next=${encodeURIComponent(redirectTo)}`}
        messages={signUpMessages}
        onSignedUp={async ({ email }) => onNavigateToVerify(email)}
      />
      <StorefrontBackLink />
    </div>
  )
}

export function CustomerVerifyEmailPage({
  email,
  onCompleted,
  onNavigateToSignIn,
  onResendVerification,
  redirectTo,
}: {
  email?: string
  onCompleted: () => Promise<void>
  onNavigateToSignIn: () => void
  onResendVerification: (email: string) => Promise<void>
  redirectTo: string
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-md py-10">
      <VerifyEmailPage
        mode="otp"
        email={email}
        signInHref={`/shop/account/sign-in?next=${encodeURIComponent(redirectTo)}&verify=1`}
        messages={verifyEmailMessages}
        onCompleted={onCompleted}
        onResendVerification={onResendVerification}
        onSignInClick={onNavigateToSignIn}
      />
    </div>
  )
}

function StorefrontBackLink(): React.ReactElement {
  return (
    <div className="mt-4 text-center">
      <a href="/shop" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Back to storefront
      </a>
    </div>
  )
}
