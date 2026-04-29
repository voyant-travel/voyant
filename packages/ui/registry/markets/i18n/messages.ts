export type RegistryMarketsMessages = {
  page: {
    title: string
    description: string
    addMarket: string
    empty: {
      loading: string
      noMarkets: string
    }
    selected: {
      title: string
      close: string
    }
    columns: {
      code: string
      name: string
      country: string
      language: string
      currency: string
      status: string
      configure: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  currenciesTab: {
    description: string
    add: string
    empty: {
      loading: string
      noCurrencies: string
    }
    columns: {
      currency: string
      default: string
      settlement: string
      reporting: string
      sort: string
      status: string
    }
    values: {
      yes: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  localesTab: {
    description: string
    add: string
    empty: {
      loading: string
      noLocales: string
    }
    columns: {
      language: string
      default: string
      sort: string
      status: string
    }
    actions: {
      deleteConfirm: string
    }
  }
}
