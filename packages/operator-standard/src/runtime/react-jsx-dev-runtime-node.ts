import { createRequire } from "node:module"

const runtime = createRequire(import.meta.url)(
  "react/jsx-dev-runtime",
) as typeof import("react/jsx-dev-runtime")

export const { Fragment, jsxDEV } = runtime
