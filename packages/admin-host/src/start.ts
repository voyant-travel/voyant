import { createCsrfMiddleware, createStart } from "@tanstack/react-start"

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
})

export const standardOperatorStart = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [csrfMiddleware],
}))
