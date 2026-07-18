import { Alert, AlertDescription, Badge } from "@voyant-travel/ui/components"
import { ExternalLink, KeyRound } from "lucide-react"
import type { AppsUiMessages } from "../i18n/messages.js"
import { type NormalizedReleaseConsent, normalizedReleaseConsentSchema } from "../schemas.js"

export function readConsentDisclosures(
  normalizedRecord: Record<string, unknown>,
): NormalizedReleaseConsent | null {
  const parsed = normalizedReleaseConsentSchema.safeParse(normalizedRecord)
  return parsed.success ? parsed.data : null
}

export function ConsentDisclosures({
  disclosure,
  messages,
}: {
  disclosure: NormalizedReleaseConsent
  messages: AppsUiMessages
}) {
  const t = messages.consent
  const extensions = [
    ...disclosure.adminPages.map((page) => ({
      key: `page:${page.key}`,
      label: page.titleKey,
      detail: `${t.pageExtension} · ${page.path}`,
    })),
    ...disclosure.slotExtensions.map((extension) => ({
      key: `slot:${extension.key}`,
      label: extension.titleKey,
      detail: `${t.slotExtension} · ${extension.slots.join(", ")}`,
    })),
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-slot="app-consent-disclosures">
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t.dataHeading}</h3>
        <DisclosureRow label={t.classifications}>
          <span className="flex flex-wrap gap-1.5">
            {disclosure.data.classifications.map((classification) => (
              <Badge key={classification} variant="secondary">
                {classification}
              </Badge>
            ))}
          </span>
        </DisclosureRow>
        <DisclosureRow label={t.retention}>
          <span className="text-sm text-muted-foreground">{disclosure.data.retention}</span>
        </DisclosureRow>
        <Alert>
          <KeyRound className="size-4" />
          <AlertDescription>
            <span className="font-medium">{t.storesSecrets}: </span>
            {disclosure.data.storesSecrets ? t.storesSecretsYes : t.storesSecretsNo}
          </AlertDescription>
        </Alert>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t.webhooksHeading}</h3>
        {disclosure.webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noWebhooks}</p>
        ) : (
          <ul className="space-y-2">
            {disclosure.webhooks.map((webhook) => (
              <li key={`${webhook.eventType}:${webhook.eventVersion}`} className="text-sm">
                <span className="font-mono">{webhook.eventType}</span>{" "}
                <Badge variant="outline">v{webhook.eventVersion}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t.extensionsHeading}</h3>
        {extensions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noExtensions}</p>
        ) : (
          <ul className="space-y-2">
            {extensions.map((extension) => (
              <li key={extension.key} className="flex flex-col text-sm">
                <span className="font-medium">{extension.label}</span>
                <span className="text-xs text-muted-foreground">{extension.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t.policiesHeading}</h3>
        <PolicyLink href={disclosure.urls.privacy} label={t.privacyPolicy} />
        <PolicyLink href={disclosure.urls.support} label={t.support} />
      </section>
    </div>
  )
}

function DisclosureRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function PolicyLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      {label}
      <ExternalLink className="size-3.5" />
    </a>
  )
}
