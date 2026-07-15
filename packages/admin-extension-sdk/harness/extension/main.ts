import { initUiExtension } from "../../dist/index.js"

const root = document.getElementById("root")

function line(label: string, value: string): string {
  return `<div class="row"><span class="key">${label}</span><span class="val">${value}</span></div>`
}

async function main() {
  if (!root) return
  root.innerHTML = `<p class="status">Connecting to admin host…</p>`

  const handle = await initUiExtension()
  const { org, viewer, entity, theme, locale } = handle.context

  const render = () => {
    const context = handle.context
    root.innerHTML = `
      <h1>Acme Reviews</h1>
      <p class="status">Connected via admin UI-extension API v${handle.apiVersion} · slot <code>${handle.slot}</code></p>
      <div class="grid">
        ${line("Org", `${context.org.name} (${context.org.slug})`)}
        ${line("Viewer", `${context.viewer.displayName} · ${context.viewer.id}`)}
        ${line("Entity", context.entity ? `${context.entity.type} · ${context.entity.id}` : "—")}
        ${line("Theme", context.theme)}
        ${line("Locale", context.locale)}
      </div>
      <div class="actions">
        <button id="toast">Send success toast</button>
        <button id="nav">Navigate to /bookings</button>
      </div>
    `
    document.getElementById("toast")?.addEventListener("click", () => {
      handle.actions.toast("success", "Synced 12 reviews from Acme")
    })
    document.getElementById("nav")?.addEventListener("click", () => {
      handle.actions.navigate("/bookings")
    })
  }

  render()
  handle.onContextChange(render)
  // Keep the reported height honest even though the SDK auto-reports.
  void { org, viewer, entity, theme, locale }
}

void main()
