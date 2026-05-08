import type { LocaleMessageDefinitions } from "../runtime.js"

export type OperatorAdminNavMessages = {
  dashboard: string
  catalog: string
  catalogOrders: string
  flights: string
  flightOrders: string
  products: string
  categories: string
  bookings: string
  notifications: string
  notificationTemplates: string
  notificationReminderRules: string
  notificationDeliveries: string
  notificationReminderRuns: string
  suppliers: string
  people: string
  organizations: string
  availability: string
  resources: string
  finance: string
  invoices: string
  payments: string
  legal: string
  contracts: string
  contractTemplates: string
  policies: string
  contractNumberSeries: string
  settings: string
}

export const operatorAdminNavMessages = {
  en: {
    nav: {
      dashboard: "Dashboard",
      catalog: "Catalog",
      catalogOrders: "Orders",
      flights: "Flights",
      flightOrders: "Orders",
      products: "Products",
      categories: "Categories",
      bookings: "Bookings",
      notifications: "Notifications",
      notificationTemplates: "Templates",
      notificationReminderRules: "Reminder Rules",
      notificationDeliveries: "Deliveries",
      notificationReminderRuns: "Reminder Runs",
      suppliers: "Suppliers",
      people: "People",
      organizations: "Organizations",
      availability: "Availability",
      resources: "Resources",
      finance: "Finance",
      invoices: "Invoices",
      payments: "Payments",
      legal: "Legal",
      contracts: "Contracts",
      contractTemplates: "Contract Templates",
      policies: "Policies",
      contractNumberSeries: "Number Series",
      settings: "Settings",
    },
  },
  ro: {
    nav: {
      dashboard: "Panou",
      catalog: "Catalog",
      catalogOrders: "Comenzi",
      flights: "Zboruri",
      flightOrders: "Comenzi",
      products: "Produse",
      categories: "Categorii",
      bookings: "Rezervari",
      notifications: "Notificari",
      notificationTemplates: "Sabloane",
      notificationReminderRules: "Reguli reminder",
      notificationDeliveries: "Livrari",
      notificationReminderRuns: "Executii reminder",
      suppliers: "Furnizori",
      people: "Persoane",
      organizations: "Organizatii",
      availability: "Disponibilitate",
      resources: "Resurse",
      finance: "Financiar",
      invoices: "Facturi",
      payments: "Plati",
      legal: "Juridic",
      contracts: "Contracte",
      contractTemplates: "Sabloane contract",
      policies: "Politici",
      contractNumberSeries: "Serii numere",
      settings: "Setari",
    },
  },
} satisfies LocaleMessageDefinitions<{ nav: OperatorAdminNavMessages }>
