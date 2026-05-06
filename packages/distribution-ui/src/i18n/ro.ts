import type { DistributionUiMessages } from "./messages.js"

export const distributionUiRo = {
  common: {
    open: "Deschide",
    view: "Vezi",
    clearFilters: "Sterge Filtrele",
    searchPlaceholder: "Cauta distributie...",
    allChannels: "Toate canalele",
    received: "Primit",
    supplier: "Furnizor",
    emptyValue: "-",
    dateTimeFallback: "Indisponibil",
    active: "Activ",
    inactive: "Inactiv",
    channelKindLabels: {
      direct: "Direct",
      affiliate: "Afiliat",
      ota: "OTA",
      reseller: "Revanzator",
      marketplace: "Marketplace",
      api_partner: "Partener API",
      connect: "Connect",
    },
    channelStatusLabels: {
      active: "Activ",
      inactive: "Inactiv",
      pending: "In asteptare",
      archived: "Arhivat",
    },
    contractStatusLabels: {
      draft: "Ciorna",
      active: "Activ",
      expired: "Expirat",
      terminated: "Terminat",
    },
    paymentOwnerLabels: {
      operator: "Operator",
      channel: "Canal",
      split: "Impartit",
    },
    commissionScopeLabels: {
      booking: "Rezervare",
      product: "Produs",
      rate: "Tarif",
      category: "Categorie",
    },
    commissionTypeLabels: {
      fixed: "Fix",
      percentage: "Procent",
    },
    webhookStatusLabels: {
      pending: "In asteptare",
      processed: "Procesat",
      failed: "Esuat",
      ignored: "Ignorat",
    },
  },
  overview: {
    metrics: {
      activeChannels: {
        title: "Canale Active",
        description: "Endpoint-uri de vanzare si revanzare active",
      },
      activeContracts: {
        title: "Contracte Active",
        description: "Acorduri comerciale aflate in vigoare",
      },
      activeMappings: {
        title: "Mapari Active",
        description: "Produse expuse catre canale externe",
      },
      syncQueue: {
        title: "Coada de Sincronizare",
        description: "Evenimente inbound in asteptare sau esuate",
      },
    },
    webhookQueue: {
      title: "Coada Webhook",
      empty: "Nu exista evenimente in asteptare sau esuate in coada.",
    },
    contractsToReview: {
      title: "Contracte de Revizuit",
      empty: "Toate contractele sunt active in acest moment.",
    },
    filters: {
      allChannelsPlaceholder: "Toate canalele",
    },
  },
  tables: {
    channel: {
      channel: "Canal",
      kind: "Tip",
      status: "Status",
      website: "Website",
    },
    contract: {
      channel: "Canal",
      supplier: "Furnizor",
      status: "Status",
      payment: "Plata",
      start: "Inceput",
    },
    commission: {
      contract: "Contract",
      scope: "Domeniu",
      product: "Produs",
      type: "Tip",
      amount: "Valoare",
    },
    mapping: {
      channel: "Canal",
      product: "Produs",
      externalProduct: "Produs Extern",
      status: "Status",
    },
    bookingLink: {
      channel: "Canal",
      booking: "Rezervare",
      externalBooking: "Rezervare Externa",
      externalStatus: "Status Extern",
      synced: "Sincronizat",
    },
    webhook: {
      channel: "Canal",
      eventType: "Tip Eveniment",
      status: "Status",
      received: "Primit",
      processed: "Procesat",
    },
  },
} satisfies DistributionUiMessages
