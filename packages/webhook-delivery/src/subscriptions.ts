import type {
  InfraWebhookSubscription,
  NewInfraWebhookSubscription,
  UpdateInfraWebhookSubscription,
} from "@voyant-travel/db/schema/infra"

import {
  assertWebhookSubscriptionCreateEvents,
  assertWebhookSubscriptionUpdateEvents,
  type ExternalWebhookEventContract,
} from "./contracts.js"

export interface WebhookSubscriptionMutationStore {
  create(input: NewInfraWebhookSubscription): Promise<InfraWebhookSubscription>
  update(id: string, input: UpdateInfraWebhookSubscription): Promise<InfraWebhookSubscription>
}

export interface WebhookSubscriptionService {
  create(input: NewInfraWebhookSubscription): Promise<InfraWebhookSubscription>
  update(id: string, input: UpdateInfraWebhookSubscription): Promise<InfraWebhookSubscription>
}

export function createWebhookSubscriptionService(options: {
  contracts: readonly ExternalWebhookEventContract[]
  store: WebhookSubscriptionMutationStore
}): WebhookSubscriptionService {
  return {
    async create(input) {
      assertWebhookSubscriptionCreateEvents(input, options.contracts)
      return options.store.create(input)
    },
    async update(id, input) {
      assertWebhookSubscriptionUpdateEvents(input, options.contracts)
      return options.store.update(id, input)
    },
  }
}
