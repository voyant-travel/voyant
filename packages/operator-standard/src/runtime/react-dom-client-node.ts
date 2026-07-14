import { createRequire } from "node:module"

const ReactDomClient = createRequire(import.meta.url)(
  "react-dom/client",
) as typeof import("react-dom/client")

export default ReactDomClient
export const { createRoot, hydrateRoot } = ReactDomClient
