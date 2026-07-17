import type {
  UiExtensionContext,
  UiExtensionDescriptor,
  UiExtensionToastIntent,
} from "@voyant-travel/admin-extension-sdk"
import { useState } from "react"
import { createRoot } from "react-dom/client"

import { LocaleProvider } from "../../../admin/src/providers/locale.js"
import { OperatorAdminMessagesProvider } from "../../../admin/src/providers/operator-admin-messages.js"
import { UiExtensionHost } from "../../../admin/src/ui-extensions/ui-extension-host.js"

const context: UiExtensionContext = {
  org: { slug: "acme", name: "Acme Travel" },
  viewer: { id: "usr_ada", displayName: "Ada Lovelace" },
  entity: { type: "booking", id: "book_1029" },
  theme: "light",
  locale: "en-GB",
  appLocale: "en",
  direction: "ltr",
}

const compatible: UiExtensionDescriptor = {
  key: "acme-reviews",
  version: "1.4.0",
  displayName: "Acme Reviews",
  extensionApi: "^1",
  entryUrl: "/extension/",
  slots: ["dashboard.after-kpis"],
  config: { widget: "summary" },
}

const incompatible: UiExtensionDescriptor = {
  ...compatible,
  key: "acme-reviews-next",
  displayName: "Acme Reviews (next)",
  extensionApi: "^2",
}

const slow: UiExtensionDescriptor = {
  ...compatible,
  key: "acme-slow",
  displayName: "Slow Extension",
  entryUrl: "/extension/silent.html",
}

type LogEntry = { kind: string; detail: string }

function Harness() {
  const [log, setLog] = useState<LogEntry[]>([])
  const push = (kind: string, detail: string) => setLog((prev) => [{ kind, detail }, ...prev])

  const onNavigate = (to: string) => push("navigate", to)
  const onToast = (intent: UiExtensionToastIntent, message: string) =>
    push("toast", `${intent}: ${message}`)

  // Demo broker: mints a fake short-lived grant. In the product this calls the
  // apps module to issue a signed admin session token for the installation.
  let tokenSeq = 0
  const onRequestToken = async () => {
    tokenSeq += 1
    const tokenId = `st_demo_${tokenSeq}`
    push("token", `issued ${tokenId}`)
    return { token: `test-session-${tokenId}`, tokenId, expiresAt: Date.now() + 120_000 }
  }

  return (
    <div className="page">
      <header>
        <h1>UiExtensionHost harness</h1>
        <p>Real host component from @voyant-travel/admin, mounted against the demo bundle.</p>
      </header>

      <section>
        <h2>1 · Rendered with context + session-token broker</h2>
        <div className="host" data-scenario="rendered">
          <UiExtensionHost
            descriptor={compatible}
            slot="dashboard.after-kpis"
            context={context}
            onNavigate={onNavigate}
            onToast={onToast}
            onRequestToken={onRequestToken}
          />
        </div>
      </section>

      <section>
        <h2>2 · Incompatible version</h2>
        <div className="host" data-scenario="incompatible">
          <UiExtensionHost
            descriptor={incompatible}
            slot="dashboard.after-kpis"
            context={context}
          />
        </div>
      </section>

      <section>
        <h2>3 · Handshake timeout (fail-soft)</h2>
        <div className="host" data-scenario="timeout">
          <UiExtensionHost
            descriptor={slow}
            slot="dashboard.after-kpis"
            context={context}
            timeoutMs={2500}
          />
        </div>
      </section>

      <section>
        <h2>4 · Full-page app extension (RTL app locale)</h2>
        <div className="host" data-scenario="page">
          <UiExtensionHost
            descriptor={{ ...compatible, key: "acme-page", displayName: "Acme Settings" }}
            slot="page:/settings"
            context={{ ...context, locale: "ar", appLocale: "ar", direction: "rtl" }}
            fill
            onNavigate={onNavigate}
            onToast={onToast}
            onRequestToken={onRequestToken}
          />
        </div>
      </section>

      <section>
        <h2>Action log</h2>
        <ul className="log" data-testid="action-log">
          {log.length === 0 ? <li className="muted">No actions yet.</li> : null}
          {log.map((entry, index) => (
            <li key={index}>
              <span className={`badge badge-${entry.kind}`}>{entry.kind}</span>
              {entry.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const container = document.getElementById("root")
if (container)
  createRoot(container).render(
    <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
      <OperatorAdminMessagesProvider>
        <Harness />
      </OperatorAdminMessagesProvider>
    </LocaleProvider>,
  )
