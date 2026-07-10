import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the flights demo plugin. */
export const flightsDemoVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-flights-demo",
  packageName: "@voyant-travel/plugin-flights-demo",
  localId: "plugin-flights-demo",
  meta: {
    ownership: "package",
  },
})

export default flightsDemoVoyantPlugin
