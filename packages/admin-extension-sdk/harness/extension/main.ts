import { initUiExtension } from "../../dist/index.js"

const root = document.getElementById("root")

function line(label: string, value: string): string {
  return `<div class="row"><span class="key">${label}</span><span class="val">${value}</span></div>`
}

async function main() {
  if (!root) return
  root.innerHTML = `<p class="status">Connecting to admin host…</p>`

  const handle = await initUiExtension()
  let tokenStatus = "Not requested"

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
        ${line("Active locale", context.locale)}
        ${line("App locale", context.appLocale)}
        ${line("Direction", context.direction)}
        ${line("Session token", tokenStatus)}
      </div>
      <div class="actions">
        <button id="toast">Send success toast</button>
        <button id="nav">Navigate to /bookings</button>
        <button id="token">Request session token</button>
      </div>
    `
    document.getElementById("toast")?.addEventListener("click", () => {
      handle.actions.toast("success", "Synced 12 reviews from Acme")
    })
    document.getElementById("nav")?.addEventListener("click", () => {
      handle.actions.navigate("/bookings")
    })
    document.getElementById("token")?.addEventListener("click", () => {
      tokenStatus = "Requesting…"
      render()
      handle.actions
        .requestToken()
        .then((grant) => {
          tokenStatus = `Granted · id ${grant.tokenId}`
          render()
        })
        .catch((error: unknown) => {
          tokenStatus = `Declined · ${error instanceof Error ? error.message : "error"}`
          render()
        })
    })
  }

  render()
  handle.onContextChange(render)
}

void main()
