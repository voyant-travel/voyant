import { createRequire } from "node:module"

const ReactDomServer = createRequire(import.meta.url)(
  "react-dom/server",
) as typeof import("react-dom/server")

export default ReactDomServer
export const {
  renderToPipeableStream,
  renderToReadableStream,
  renderToStaticMarkup,
  renderToString,
  resume,
  resumeToPipeableStream,
  version,
} = ReactDomServer
