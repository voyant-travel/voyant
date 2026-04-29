import type { RegistryExtrasMessages } from "./messages"

export const registryExtrasRo = {
  common: {
    active: "Activ",
    inactive: "Inactiv",
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
    selectionTypeLabels: {
      optional: "Optional",
      required: "Obligatoriu",
      default_selected: "Selectat implicit",
      unavailable: "Indisponibil",
    },
    pricingModeLabels: {
      included: "Inclus",
      per_person: "Per persoana",
      per_booking: "Per rezervare",
      quantity_based: "Pe cantitate",
      on_request: "La cerere",
      free: "Gratuit",
    },
  },
  extrasPage: {
    title: "Extra",
    description: "Configureaza extra optionale pe care turistii le pot alege langa un produs.",
    fields: {
      product: "Produs",
      search: "Cauta extra",
    },
    placeholders: {
      product: "Selecteaza un produs...",
      search: "Cauta extra...",
    },
    help: {
      product:
        "Alege un produs pentru a gestiona extra optionale precum transferuri, upgrade-uri si degustari.",
    },
    empty: {
      selectProduct: "Selecteaza mai sus un produs pentru a configura extra lui.",
      loading: "Se incarca extra...",
      noExtras: "Nu au fost gasite extra.",
    },
    section: {
      title: "Extra produs",
      description: "Extra optionale pe care turistii le pot selecta in timpul rezervarii.",
      add: "Adauga extra",
    },
    columns: {
      name: "Nume",
      code: "Cod",
      selection: "Selectie",
      pricing: "Pret",
      quantity: "Cant.",
      sort: "Ordine",
      status: "Status",
    },
    labels: {
      perPerson: "per persoana",
      deleteConfirm: "Stergi extra?",
      defaultQuantity: "implicit",
      infinity: "nelimitat",
    },
  },
  productExtraDialog: {
    titles: {
      create: "Adauga extra",
      edit: "Editeaza extra",
    },
    fields: {
      name: "Nume",
      code: "Cod",
      description: "Descriere",
      selectionType: "Tip selectie",
      pricingMode: "Mod de pret",
      minQuantity: "Cantitate minima",
      maxQuantity: "Cantitate maxima",
      defaultQuantity: "Cantitate implicita",
      sortOrder: "Ordine",
      pricedPerPerson: "Per persoana",
      active: "Activ",
    },
    placeholders: {
      name: "Transfer aeroport",
      code: "transfer-aeroport",
      description: "Afisata turistilor cand aleg extra...",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
    },
    actions: {
      create: "Adauga extra",
    },
  },
} satisfies RegistryExtrasMessages
