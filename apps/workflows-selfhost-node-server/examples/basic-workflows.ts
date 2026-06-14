import { workflow } from "@voyant-travel/workflows"

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
