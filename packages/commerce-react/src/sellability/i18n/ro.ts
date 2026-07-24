import type { SellabilityUiMessages } from "./messages.js"

export const sellabilityUiRo = {
  common: {
    loading: "Se incarca...",
    cancel: "Anuleaza",
    active: "Activ",
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
    productStatusLabels: {
      draft: "Ciorna",
      active: "Activ",
      archived: "Arhivat",
    },
    // Etichete scurte, vocabular comun cu tabelul de produse si selectorul din
    // editor. Sincronizeaza cu cheile `bookingMode*` din catalogul operatorului.
    productBookingModeLabels: {
      date: "Excursie de o zi",
      date_time: "Activitate cu oră",
      open: "Voucher cu dată deschisă",
      stay: "Cazare",
      transfer: "Transfer",
      itinerary: "Tur de mai multe zile",
      other: "Altul",
    },
    policyScopeLabels: {
      global: "Global",
      product: "Produs",
      option: "Optiune",
      market: "Piata",
      channel: "Canal",
    },
    policyTypeLabels: {
      capability: "Capabilitate",
      occupancy: "Ocupare",
      pickup: "Preluare",
      question: "Intrebare",
      allotment: "Alocare",
      availability_window: "Fereastra de disponibilitate",
      currency: "Moneda",
      custom: "Personalizat",
    },
  },
  channelCombobox: {
    placeholder: "Selecteaza canal...",
    empty: "Nu s-au gasit canale.",
  },
  marketCombobox: {
    placeholder: "Cauta piete...",
    empty: "Nu s-au gasit piete.",
  },
  productCombobox: {
    placeholder: "Cauta produse...",
    empty: "Nu s-au gasit produse.",
  },
  productOptionCombobox: {
    placeholder: "Selecteaza optiunea produsului...",
    empty: "Nu s-au gasit optiuni de produs.",
    selectProductFirst: "Selecteaza mai intai un produs.",
  },
  policyDialog: {
    titles: {
      create: "Adauga Politica",
      edit: "Editeaza Politica",
    },
    fields: {
      name: "Nume",
      scope: "Domeniu",
      type: "Tip",
      priority: "Prioritate",
      product: "Produs",
      option: "Optiune",
      market: "Piata",
      channel: "Canal",
      conditionsJson: "Conditii",
      effectsJson: "Efecte",
      notes: "Note",
      active: "Activ",
    },
    placeholders: {
      name: "Blocheaza rezervarile fara capabilitate",
    },
    actions: {
      create: "Adauga Politica",
      save: "Salveaza Modificarile",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
      jsonObject: "Trebuie sa fie un obiect JSON",
    },
  },
} satisfies SellabilityUiMessages
