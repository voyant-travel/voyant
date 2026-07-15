import type {
  UiExtensionContext,
  UiExtensionDescriptor,
  UiExtensionToastIntent,
} from "@voyant-travel/admin-extension-sdk"
import { useState } from "react"
import { createRoot } from "react-dom/client"

import { UiExtensionHost } from "../../../admin/src/ui-extensions/ui-extension-host.js"

const context: UiExtensionContext = {
  org: { slug: "acme", name: "Acme Travel" },
  viewer: { id: "usr_ada", displayName: "Ada Lovelace" },
  entity: { type: "booking", id: "book_1029" },
  theme: "light",
  locale: "en-GB",
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

  return (
    <div className="page">
      <header>
        <h1>UiExtensionHost harness</h1>
        <p>Real host component from @voyant-travel/admin, mounted against the demo bundle.</p>
      </header>

      <section>
        <h2>1 · Rendered with context</h2>
        <div className="host" data-scenario="rendered">
          <UiExtensionHost
            descriptor={compatible}
            slot="dashboard.after-kpis"
            context={context}
            onNavigate={onNavigate}
            onToast={onToast}
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
        <h2>3 · Handshake timeout</h2>
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
if (container) createRoot(container).render(<Harness />)
