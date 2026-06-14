import "@voyant-travel/ui/globals.css"
import "@voyant-travel/workflows-react/styles.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./app"

const root = document.getElementById("root")
if (!root) throw new Error("#root element not found")
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
