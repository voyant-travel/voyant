import { createRequire } from "node:module"

const ReactDom = createRequire(import.meta.url)("react-dom") as typeof import("react-dom")

export default ReactDom
export const {
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  requestFormReset,
  unstable_batchedUpdates,
  useFormState,
  useFormStatus,
  version,
} = ReactDom
