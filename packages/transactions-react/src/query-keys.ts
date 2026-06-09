export interface OffersListFilters {
  status?: string | undefined
  quoteId?: string | undefined
  quoteVersionId?: string | undefined
  personId?: string | undefined
  organizationId?: string | undefined
  marketId?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OrdersListFilters {
  status?: string | undefined
  offerId?: string | undefined
  quoteId?: string | undefined
  quoteVersionId?: string | undefined
  personId?: string | undefined
  organizationId?: string | undefined
  marketId?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const transactionsQueryKeys = {
  all: ["transactions"] as const,
  offers: () => [...transactionsQueryKeys.all, "offers"] as const,
  offersList: (filters: OffersListFilters) => [...transactionsQueryKeys.offers(), filters] as const,
  offer: (id: string) => [...transactionsQueryKeys.offers(), id] as const,
  orders: () => [...transactionsQueryKeys.all, "orders"] as const,
  ordersList: (filters: OrdersListFilters) => [...transactionsQueryKeys.orders(), filters] as const,
  order: (id: string) => [...transactionsQueryKeys.orders(), id] as const,
}
