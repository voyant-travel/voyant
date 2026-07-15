"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type AdminExtension,
  type AdminRouteLoaderContext,
  type AdminSetupStepContribution,
  adminRoutePageModule,
  defineAdminExtension,
  resolveAdminSetupSteps,
  type SelectedAdminExtensionFactoryContext,
  useAdminExtensions,
} from "@voyant-travel/admin"
import { useLocale } from "@voyant-travel/admin/providers/locale"
import { useVoyantReactContext } from "@voyant-travel/react"
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from "@voyant-travel/ui/components"
import { ArrowLeft, Check, ClipboardCheck, ExternalLink, Loader2, Minus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { initializeSetupClient, updateSetupStepClient } from "./client.js"
import { resolveSetupMessages } from "./i18n/index.js"

const setupQueryKey = (stepIds: readonly string[]) => ["organization-setup", ...stepIds] as const

export async function initializeSelectedSetup(
  context: AdminRouteLoaderContext,
  input: { stepIds: readonly string[]; fresh: boolean },
) {
  const state = await initializeSetupClient(context.runtime, {
    stepIds: [...input.stepIds],
    fresh: input.fresh,
  })
  return state.shouldRedirect ? { redirectTo: "/setup" } : {}
}

export function createSelectedSetupAdminExtension({
  navMessages,
}: SelectedAdminExtensionFactoryContext): AdminExtension {
  const title = navMessages.setup ?? "Setup"
  return defineAdminExtension({
    id: "setup",
    setupFlow: {
      id: "@voyant-travel/setup#flow.organization-setup",
      initialize: initializeSelectedSetup,
    },
    navigation: [
      {
        order: 1000,
        items: [{ id: "setup", title, url: "/setup", icon: ClipboardCheck }],
      },
    ],
    routes: [
      {
        id: "setup-index",
        path: "/setup",
        title,
        ssr: "data-only",
        page: () =>
          import("./setup-page.js").then((module) => adminRoutePageModule(module.SetupPage)),
      },
    ],
  })
}

export function SetupPage() {
  const extensions = useAdminExtensions()
  const steps = useMemo(() => resolveAdminSetupSteps(extensions), [extensions])
  const stepIds = useMemo(() => steps.map((step) => step.id), [steps])
  const runtime = useVoyantReactContext()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = resolveSetupMessages(resolvedLocale)
  const [predicateError, setPredicateError] = useState(false)
  const checked = useRef(new Set<string>())
  const query = useQuery({
    queryKey: setupQueryKey(stepIds),
    queryFn: () => initializeSetupClient(runtime, { stepIds, fresh: false }),
  })

  useEffect(() => {
    if (!query.data) return
    const states = new Map(query.data.steps.map((state) => [state.stepId, state]))
    const pending = steps.filter((step) => {
      const state = states.get(step.id)
      return !state?.completedAt && !checked.current.has(step.id)
    })
    if (pending.length === 0) return
    for (const step of pending) checked.current.add(step.id)
    const context: AdminRouteLoaderContext = { queryClient, runtime, params: {} }
    void Promise.all(
      pending.map(async (step) => {
        if (await step.isComplete(context)) {
          await updateSetupStepClient(runtime, step.id, "complete")
          return true
        }
        return false
      }),
    )
      .then((results) => {
        if (results.some(Boolean)) void query.refetch()
      })
      .catch(() => setPredicateError(true))
  }, [query.data, query.refetch, queryClient, runtime, steps])

  if (query.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {messages.loading}
      </div>
    )
  }
  if (query.isError || !query.data) {
    return <div className="p-6 text-sm text-destructive">{messages.loadFailed}</div>
  }

  const states = new Map(query.data.steps.map((state) => [state.stepId, state]))
  const completed = steps.filter((step) => states.get(step.id)?.completedAt).length
  const terminal = steps.filter((step) => {
    const state = states.get(step.id)
    return state?.completedAt || state?.skippedAt
  }).length

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{messages.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{messages.description}</p>
        </div>
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4" />
          {messages.back}
        </a>
      </header>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            {messages.progress
              .replace("{complete}", String(completed))
              .replace("{total}", String(steps.length))}
          </span>
          <span className="text-muted-foreground">
            {Math.round((terminal / Math.max(steps.length, 1)) * 100)}%
          </span>
        </div>
        <Progress value={(terminal / Math.max(steps.length, 1)) * 100} />
      </div>

      {predicateError ? (
        <p className="text-sm text-muted-foreground">{messages.loadFailed}</p>
      ) : null}

      <div className="grid gap-3">
        {steps.map((step) => (
          <SetupStepCard
            key={step.id}
            step={step}
            state={states.get(step.id)}
            prefill={query.data.prefill[step.id]}
            locale={resolvedLocale}
            onSkip={async () => {
              await updateSetupStepClient(runtime, step.id, "skip")
              await query.refetch()
            }}
          />
        ))}
      </div>

      {steps.length > 0 && terminal === steps.length ? (
        <div className="border-t pt-6">
          <h2 className="text-base font-semibold">{messages.allDoneTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.allDoneDescription}</p>
        </div>
      ) : null}
    </div>
  )
}

function SetupStepCard({
  step,
  state,
  prefill,
  locale,
  onSkip,
}: {
  step: AdminSetupStepContribution
  state?: { completedAt: string | null; skippedAt: string | null }
  prefill: unknown
  locale: string | null | undefined
  onSkip: () => Promise<void>
}) {
  const shell = resolveSetupMessages(locale)
  const copy = resolveStepMessages(step, locale)
  const [skipping, setSkipping] = useState(false)
  const complete = Boolean(state?.completedAt)
  const skipped = Boolean(state?.skippedAt)
  const Action = step.actionComponent
  const resolvedPrefill = step.prefill ? step.prefill(prefill) : prefill

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </div>
        <Badge variant={complete ? "secondary" : "outline"}>
          {complete ? <Check className="size-3" /> : skipped ? <Minus className="size-3" /> : null}
          {complete ? shell.complete : skipped ? shell.skipped : shell.pending}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {Action ? (
          <Action label={copy.action} prefill={resolvedPrefill} />
        ) : step.href ? (
          <a href={step.href} className={buttonVariants()}>
            {copy.action}
            <ExternalLink className="size-4" />
          </a>
        ) : null}
        {!complete && !skipped && step.skippable ? (
          <Button
            type="button"
            variant="ghost"
            disabled={skipping}
            onClick={() => {
              setSkipping(true)
              void onSkip().finally(() => setSkipping(false))
            }}
          >
            {skipping ? <Loader2 className="size-4 animate-spin" /> : null}
            {shell.skip}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function resolveStepMessages(step: AdminSetupStepContribution, locale: string | null | undefined) {
  const language = locale?.toLowerCase().startsWith("ro") ? "ro" : "en"
  return step.messages[language] ?? step.messages.en ?? Object.values(step.messages)[0]!
}
