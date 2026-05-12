# @voyantjs/auth-ui

Importable React UI components for Voyant auth surfaces. Bundler-consumed
(Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/auth-ui @voyantjs/auth-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/auth-react`
provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or
compose to extend; use the registry copy-paste path for components you want to
fork outright.

Workspace page components render with `p-6` outer padding by default and are
intended to mount directly into an app route outlet. Auth flow pages are
card-less, centered form surfaces intended to sit inside an app-owned auth
layout. Pass `className` to extend or override spacing when a shell owns the
page chrome.

## Account self-service

`AccountPage` renders the reusable operator account surface with profile,
email-change, and password-change forms. It uses `OperatorAdminPageShell` and
accepts slot/render-prop panels for app-specific account sections such as API
tokens, sessions, or MFA enrollment.

```tsx
import { AccountPage } from "@voyantjs/auth-ui"

<AccountPage
  slots={{
    apiTokensPanel: ({ user }) => <ApiTokensPanel userId={user?.id ?? null} />,
  }}
/>
```

The forms are also exported independently:

```tsx
import {
  AccountChangeEmailForm,
  AccountChangePasswordForm,
  AccountProfileForm,
} from "@voyantjs/auth-ui"
```

`AccountProfileForm` expects the app to support `PATCH /auth/me`.
`AccountChangePasswordForm`, `AccountChangeEmailForm`, and `AccountPage` use the
Better Auth password and Email OTP endpoints mounted under `/auth`.

## Sign-in

`SignInPage` provides the shared email/password sign-in surface. It uses
`useSignIn()` from `@voyantjs/auth-react`, which posts to the mounted Better
Auth email endpoint and refreshes Voyant auth queries after success.

```tsx
import { SignInPage } from "@voyantjs/auth-ui"

<SignInPage
  redirectTo="/"
  forgotPasswordHref="/forgot-password"
  signUpHref="/sign-up"
  onSignedIn={({ redirectTo }) => navigate({ to: redirectTo ?? "/" })}
/>
```

Social providers and email-verification resend behavior stay app-owned because
they need router and provider-plugin wiring:

```tsx
<SignInPage
  socialProviders={[
    {
      id: "google",
      label: "Continue with Google",
      onSignIn: ({ redirectTo }) =>
        authClient.signIn.social({ provider: "google", callbackURL: redirectTo }),
    },
  ]}
  onResendVerification={(email) =>
    authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
  }
/>
```

## Onboarding

`OnboardingPage` provides the shared first-run profile completion surface. It is
card-less and router-agnostic: apps own the surrounding auth layout and decide
where to navigate after `onCompleted`.

```tsx
import { OnboardingPage } from "@voyantjs/auth-ui"

<OnboardingPage
  initialProfile={user}
  onCompleted={() => navigate({ to: "/" })}
  slots={{
    afterFields: <WorkspaceInvitePicker />,
  }}
/>
```

The page submits first name, last name, and optional locale/timezone fields via
`useUpdateAccountProfile()`. Pass `showLocale={false}` or
`showTimezone={false}` if the mounted app API does not support those fields.
