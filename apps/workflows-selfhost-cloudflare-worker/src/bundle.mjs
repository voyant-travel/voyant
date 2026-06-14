// packages/workflows/dist/workflow.js
var REGISTRY_KEY = "__voyantWorkflowRegistry"
var globalRef = globalThis
var REGISTRY = (globalRef[REGISTRY_KEY] ??= /* @__PURE__ */ new Map())
function workflow(config) {
  if (REGISTRY.has(config.id)) {
    throw new Error(`workflow id "${config.id}" is already registered`)
  }
  const def = {
    id: config.id,
    config,
  }
  REGISTRY.set(config.id, def)
  return def
}

// packages/workflows/dist/trigger.js
var _workflows = new Proxy(
  {},
  {
    get(_, method) {
      return () => {
        throw new Error(
          `@voyant-travel/workflows: workflows.${method}() requires the Voyant Cloud client. Install + configure it via @voyant-travel/client, or see docs/sdk-surface.md \xA76.`,
        )
      }
    },
  },
)

// apps/workflows-selfhost-node-server/examples/basic-workflows.ts
workflow({
  id: "docker-hello",
  description: "Minimal workflow used to smoke-test the Node/Docker self-host target.",
  input: { name: "string?" },
  async run(input) {
    return {
      ok: true,
      greeting: `hello ${input?.name ?? "world"}`,
    }
  },
})
