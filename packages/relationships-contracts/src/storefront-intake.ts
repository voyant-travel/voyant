/** Import-cheap context shared by Storefront intake and its persistence provider. */
export interface StorefrontIntakeContext {
  db?: unknown
  eventBus?: unknown
  env?: unknown
  context?: unknown
}

export interface StorefrontIntakeSignal {
  id: string
  personId: string
  kind: "wishlist" | "notify" | "inquiry" | "request_offer" | "referral"
  source: "form" | "phone" | "admin" | "abandoned_cart" | "website" | "booking"
  status: "new" | "contacted" | "qualified" | "converted" | "lost" | "expired"
  productId?: string | null
  optionUnitId?: string | null
  sourceSubmissionId?: string | null
  metadata?: Record<string, unknown> | null
}

export interface StorefrontIntakePerson {
  id: string
}

export interface StorefrontIntakePersistence<
  Context extends StorefrontIntakeContext = StorefrontIntakeContext,
> {
  findSignal(input: {
    context: Context
    kind: StorefrontIntakeSignal["kind"]
    sourceSubmissionId: string
  }): Promise<StorefrontIntakeSignal | null> | StorefrontIntakeSignal | null
  createPerson(input: {
    context: Context
    data: {
      firstName: string
      lastName: string
      status: "active"
      website: string | null
      email?: string | null
      phone?: string | null
      source: string
      sourceRef: string
      tags: string[]
    }
  }): Promise<StorefrontIntakePerson | null> | StorefrontIntakePerson | null
  createCustomerSignal(input: {
    context: Context
    data: {
      personId: string
      productId?: string | null
      optionUnitId?: string | null
      kind: StorefrontIntakeSignal["kind"]
      source: StorefrontIntakeSignal["source"]
      status: "new"
      priority: "normal"
      notes?: string | null
      tags: string[]
      sourceSubmissionId: string
      metadata: Record<string, unknown>
    }
  }): Promise<StorefrontIntakeSignal | null> | StorefrontIntakeSignal | null
  updateCustomerSignal(input: {
    context: Context
    id: string
    data: {
      metadata: Record<string, unknown>
    }
  }): Promise<StorefrontIntakeSignal | null> | StorefrontIntakeSignal | null
  deleteCustomerSignal(input: { context: Context; id: string }): Promise<unknown> | unknown
  deletePerson(input: { context: Context; id: string }): Promise<unknown> | unknown
}
