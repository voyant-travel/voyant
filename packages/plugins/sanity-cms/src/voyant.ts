import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the Sanity CMS plugin. */
export const sanityCmsVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-sanity-cms",
  packageName: "@voyant-travel/plugin-sanity-cms",
  localId: "plugin-sanity-cms",
  subscribers: [
    {
      id: "@voyant-travel/plugin-sanity-cms#subscriber.product-created",
      eventType: "product.created",
      source: "@voyant-travel/plugin-sanity-cms",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#subscriber.product-updated",
      eventType: "product.updated",
      source: "@voyant-travel/plugin-sanity-cms",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#subscriber.product-deleted",
      eventType: "product.deleted",
      source: "@voyant-travel/plugin-sanity-cms",
    },
  ],
  config: [
    {
      id: "@voyant-travel/plugin-sanity-cms#config.project-id",
      key: "projectId",
      required: true,
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.dataset",
      key: "dataset",
      required: true,
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.document-type",
      key: "documentType",
      required: true,
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.api-version",
      key: "apiVersion",
      default: "2024-01-01",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.voyant-id-field",
      key: "voyantIdField",
      default: "voyantId",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.api-host",
      key: "apiHost",
      default: "api.sanity.io",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.created-event",
      key: "events.created",
      default: "product.created",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.updated-event",
      key: "events.updated",
      default: "product.updated",
    },
    {
      id: "@voyant-travel/plugin-sanity-cms#config.deleted-event",
      key: "events.deleted",
      default: "product.deleted",
    },
  ],
  secrets: [
    {
      id: "@voyant-travel/plugin-sanity-cms#secret.token",
      key: "token",
      required: true,
      description: "Sanity API token with write access.",
      rotation: "replace-only",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/plugin-sanity-cms#resource.api",
      kind: "http-service",
      required: true,
      config: { service: "sanity-content-lake" },
    },
  ],
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale: "This plugin synchronizes catalog events; catalog modules own agent capabilities.",
    },
  },
})

export default sanityCmsVoyantPlugin
