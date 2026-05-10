import type { DistributionUiMessages } from "./messages.js"

export const distributionUiRo = {
  common: {
    open: "Deschide",
    view: "Vezi",
    cancel: "Anuleaza",
    create: "Creeaza",
    save: "Salveaza",
    delete: "Sterge",
    clearFilters: "Sterge Filtrele",
    clearSelection: "Goleste selectia",
    backToDistribution: "Inapoi la Distributie",
    loading: "Se incarca...",
    none: "-",
    openEnded: "Fara termen",
    noReference: "Fara referinta",
    unmappedStatus: "Status neasociat",
    yes: "Da",
    searchPlaceholder: "Cauta distributie...",
    allChannels: "Toate canalele",
    received: "Primit",
    supplier: "Furnizor",
    channelLabel: "Canal",
    contractLabel: "Contract",
    productLabel: "Produs",
    bookingLabel: "Rezervare",
    supplierLabel: "Furnizor",
    createdLabel: "Creat",
    updatedLabel: "Actualizat",
    emptyValue: "-",
    dateTimeFallback: "Indisponibil",
    active: "Activ",
    inactive: "Inactiv",
    selectionSummary: "{count} selectate",
    resultSummary: "{verb} {countLabel}.",
    deleteSummary: "S-au sters {countLabel}.",
    entities: {
      channel: { one: "canal", other: "canale" },
      contract: { one: "contract", other: "contracte" },
      commissionRule: { one: "regula de comision", other: "reguli de comision" },
      mapping: { one: "mapare", other: "mapari" },
      bookingLink: { one: "legatura de rezervare", other: "legaturi de rezervare" },
      webhookEvent: { one: "eveniment webhook", other: "evenimente webhook" },
    },
    cancellationOwnerLabels: {
      operator: "Operator",
      channel: "Canal",
      mixed: "Mixt",
    },
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
  page: {
    title: "Distributie",
    description:
      "Gestioneaza canalele de vanzare, contractele comerciale, maparile externe si evenimentele de sincronizare.",
    tabs: {
      channels: "Canale",
      contracts: "Contracte",
      commissions: "Reguli de comision",
      mappings: "Mapari produse",
      bookingLinks: "Legaturi rezervari",
      webhooks: "Evenimente webhook",
    },
    bulkVerbs: {
      activated: "Au fost activate",
      archived: "Au fost arhivate",
      deleted: "Au fost sterse",
      expired: "Au fost expirate",
      deactivated: "Au fost dezactivate",
      processed: "Au fost procesate",
      ignored: "Au fost ignorate",
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
  tabs: {
    channels: {
      title: "Canale",
      description: "Parteneri de vanzare, afiliati, OTA-uri, marketplace-uri si canale directe.",
      actionLabel: "Canal nou",
      empty: "Niciun canal nu corespunde filtrelor curente.",
      actions: {
        activate: {
          button: "Activeaza",
          confirm: "Activeaza canalele",
          title: "Activezi {countLabel}?",
          description: "Aceasta actiune reactiveaza canalele selectate pentru distributie live.",
        },
        archive: {
          button: "Arhiveaza",
          confirm: "Arhiveaza canalele",
          title: "Arhivezi {countLabel}?",
          description:
            "Aceasta actiune pastreaza canalele selectate in istoric, dar le scoate din uzul comercial activ.",
        },
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge canalele",
          title: "Stergi {countLabel}?",
          description:
            "Aceasta actiune sterge definitiv canalele selectate. Foloseste Arhiveaza daca vrei doar sa le retragi din uzul activ.",
        },
      },
    },
    contracts: {
      title: "Contracte",
      description: "Termeni comerciali pentru fiecare relatie canal-furnizor.",
      actionLabel: "Contract nou",
      empty: "Niciun contract nu corespunde filtrelor curente.",
      actions: {
        activate: {
          button: "Activeaza",
          confirm: "Activeaza contractele",
          title: "Activezi {countLabel}?",
          description:
            "Aceasta actiune marcheaza contractele selectate ca active din punct de vedere comercial.",
        },
        expire: {
          button: "Expira",
          confirm: "Expira contractele",
          title: "Expiri {countLabel}?",
          description:
            "Aceasta actiune pastreaza contractele selectate, dar le marcheaza ca iesite din vigoare.",
        },
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge contractele",
          title: "Stergi {countLabel}?",
          description:
            "Aceasta actiune sterge definitiv contractele selectate si configurarea lor comerciala.",
        },
      },
    },
    commissions: {
      title: "Reguli de comision",
      description: "Defineste logica de comision pentru rezervare, produs, tarif si categorie.",
      actionLabel: "Regula de comision noua",
      empty: "Nicio regula de comision nu corespunde filtrelor curente.",
      actions: {
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge regulile de comision",
          title: "Stergi {countLabel}?",
          description:
            "Aceasta actiune sterge definitiv regulile de comision selectate din configurarea canalului.",
        },
      },
    },
    mappings: {
      title: "Mapari produse",
      description: "Mapeaza produsele Voyant la identificatorii de catalog ai canalelor externe.",
      actionLabel: "Mapare noua",
      empty: "Nicio mapare de produs nu corespunde filtrelor curente.",
      actions: {
        activate: {
          button: "Activeaza",
          confirm: "Activeaza maparile",
          title: "Activezi {countLabel}?",
          description:
            "Aceasta actiune reactiveaza maparile externe selectate pentru utilizare live pe canal.",
        },
        deactivate: {
          button: "Dezactiveaza",
          confirm: "Dezactiveaza maparile",
          title: "Dezactivezi {countLabel}?",
          description:
            "Aceasta actiune pastreaza maparile selectate ca referinta, dar le scoate din sincronizarea activa.",
        },
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge maparile",
          title: "Stergi {countLabel}?",
          description: "Aceasta actiune sterge definitiv maparile externe de produs selectate.",
        },
      },
    },
    bookingLinks: {
      title: "Legaturi rezervari",
      description:
        "Urmareste ID-urile de rezervare externe si starea sincronizarii pentru rezervarile venite din canale.",
      actionLabel: "Legatura noua",
      empty: "Nicio legatura de rezervare nu corespunde filtrelor curente.",
      actions: {
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge legaturile",
          title: "Stergi {countLabel}?",
          description:
            "Aceasta actiune sterge definitiv referintele externe si legaturile de sincronizare selectate.",
        },
      },
    },
    webhooks: {
      title: "Evenimente webhook",
      description: "Inspecteaza evenimentele primite de la parteneri si cazurile cu probleme.",
      actionLabel: "Eveniment webhook nou",
      empty: "Niciun eveniment webhook nu corespunde filtrelor curente.",
      actions: {
        markProcessed: {
          button: "Marcheaza procesat",
          confirm: "Marcheaza procesat",
          title: "Marchezi {countLabel} ca procesate?",
          description:
            "Aceasta actiune marcheaza evenimentele selectate ca procesate si le scoate din coada activa de sincronizare.",
        },
        ignore: {
          button: "Ignora",
          confirm: "Ignora evenimentele",
          title: "Ignori {countLabel}?",
          description:
            "Aceasta actiune pastreaza evenimentele selectate in istoric, dar le marcheaza ca ignorate intentionat.",
        },
        delete: {
          button: "Sterge selectia",
          confirm: "Sterge evenimentele",
          title: "Stergi {countLabel}?",
          description:
            "Aceasta actiune sterge definitiv evenimentele webhook selectate din jurnalul de evenimente.",
        },
      },
    },
  },
  details: {
    channel: {
      notFound: "Canalul nu a fost gasit",
      title: "Detalii canal",
      deleteConfirm: "Stergi acest canal?",
      deleteDescription:
        "Aceasta actiune sterge definitiv canalul si configurarea sa de distributie.",
      deleteButton: "Sterge",
      sections: {
        details: "Detalii canal",
        metadata: "Metadata",
        contracts: "Contracte",
        mappings: "Mapari produse",
        bookingLinks: "Legaturi rezervari",
        webhooks: "Evenimente webhook",
      },
      labels: {
        website: "Website",
        contactName: "Nume contact",
        contactEmail: "Email contact",
        supplier: "Furnizor",
        payment: "Plata",
        cancellation: "Anulare",
        externalProduct: "Produs extern",
        externalBooking: "Rezervare externa",
        reference: "Referinta",
        lastSynced: "Ultima sincronizare",
        rate: "Tarif",
        category: "Categorie",
        booking: "Rezervare",
      },
      empty: {
        metadata: "Nu exista metadata setata.",
        contracts: "Nu exista contracte pentru acest canal.",
        mappings: "Nu exista mapari de produse pentru acest canal.",
        bookingLinks: "Nu exista legaturi de rezervare pentru acest canal.",
        webhooks: "Nu exista evenimente webhook pentru acest canal.",
      },
    },
    contract: {
      notFound: "Contractul nu a fost gasit",
      title: "Contract canal",
      deleteConfirm: "Stergi acest contract?",
      deleteDescription:
        "Aceasta actiune sterge definitiv contractul si configurarea sa comerciala de distributie.",
      deleteButton: "Sterge",
      openChannel: "Deschide canalul",
      sections: {
        details: "Detalii contract",
        notes: "Note comerciale",
        commissionRules: "Reguli de comision",
      },
      labels: {
        supplier: "Furnizor",
        endsAt: "Se termina la",
        paymentOwner: "Responsabil plata",
        cancellationOwner: "Responsabil anulare",
        settlementTerms: "Termeni de decontare",
        notes: "Note",
        amount: "Valoare",
        basisPoints: "Puncte baza",
        rate: "Tarif",
        category: "Categorie",
        valid: "Valabil",
      },
      empty: {
        commissionRules: "Nu exista reguli de comision pentru acest contract.",
      },
    },
  },
} satisfies DistributionUiMessages
