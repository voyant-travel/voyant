import type { RegistryGroundMessages } from "./messages"

export const registryGroundRo: RegistryGroundMessages = {
  common: {
    yes: "Da",
    no: "Nu",
    active: "Activ",
    inactive: "Inactiv",
    cancel: "Renunta",
    saveChanges: "Salveaza modificarile",
    categoryLabels: {
      car: "Masina",
      sedan: "Sedan",
      suv: "SUV",
      van: "Van",
      minibus: "Microbuz",
      bus: "Autocar",
      boat: "Barca",
      train: "Tren",
      other: "Altul",
    },
    classLabels: {
      economy: "Economic",
      standard: "Standard",
      premium: "Premium",
      luxury: "Luxury",
      accessible: "Accesibil",
      other: "Altul",
    },
  },
  page: {
    title: "Operatiuni Terestre",
    tabs: {
      operators: "Operatori",
      vehicles: "Vehicule",
      drivers: "Soferi",
    },
  },
  operatorsTab: {
    description:
      "Operatori de transport precum flote DMC, parteneri de transfer si companii de inchirieri.",
    add: "Adauga operator",
    empty: {
      loading: "Se incarca operatorii...",
      none: "Nu exista operatori.",
    },
    columns: {
      name: "Nume",
      code: "Cod",
      supplier: "Furnizor",
      facility: "Facilitate",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Stergi acest operator?",
    },
  },
  operatorDialog: {
    addTitle: "Adauga operator",
    editTitle: "Editeaza operatorul",
    fields: {
      name: "Nume",
      code: "Cod",
      supplier: "Furnizor (optional)",
      facility: "Facilitate (optional)",
      notes: "Note",
      active: "Activ",
    },
    placeholders: {
      name: "Istanbul Transfer Co.",
      code: "istanbul-transfer",
      supplier: "Cauta furnizori...",
      supplierEmpty: "Nu exista furnizori.",
      facility: "Cauta facilitati...",
      facilityEmpty: "Nu exista facilitati.",
    },
    errors: {
      nameRequired: "Numele este obligatoriu",
    },
    actions: {
      add: "Adauga operator",
    },
  },
  driversTab: {
    description: "Soferi atasati operatorilor. Fiecare sofer este asociat unui resource.",
    add: "Adauga sofer",
    empty: {
      loading: "Se incarca soferii...",
      none: "Nu exista soferi.",
    },
    columns: {
      resource: "Resource",
      operator: "Operator",
      license: "Permis",
      languages: "Limbi",
      guide: "Ghid",
      meetAndGreet: "M&G",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Stergi acest sofer?",
    },
  },
  driverDialog: {
    addTitle: "Adauga sofer",
    editTitle: "Editeaza soferul",
    fields: {
      resource: "Resource",
      operator: "Operator (optional)",
      licenseNumber: "Numar permis",
      spokenLanguages: "Limbi vorbite (separate prin virgula)",
      notes: "Note",
      guide: "Ghid",
      meetAndGreet: "Meet & greet",
      active: "Activ",
    },
    placeholders: {
      resource: "Cauta resurse...",
      resourceEmpty: "Nu exista resurse.",
      operator: "Cauta operatori...",
      operatorEmpty: "Nu exista operatori.",
      spokenLanguages: "en, tr, ar",
    },
    errors: {
      resourceRequired: "ID-ul resursei este obligatoriu",
    },
    actions: {
      add: "Adauga sofer",
    },
  },
  vehiclesTab: {
    description: "Vehicule atasate operatorilor. Fiecare vehicul este asociat unui resource.",
    add: "Adauga vehicul",
    empty: {
      loading: "Se incarca vehiculele...",
      none: "Nu exista vehicule.",
    },
    columns: {
      resource: "Resource",
      operator: "Operator",
      category: "Categorie",
      class: "Clasa",
      passengers: "Pax",
      accessible: "Accesibil",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Stergi acest vehicul?",
    },
  },
  vehicleDialog: {
    addTitle: "Adauga vehicul",
    editTitle: "Editeaza vehiculul",
    fields: {
      resource: "Resource",
      operator: "Operator (optional)",
      category: "Categorie",
      class: "Clasa",
      passengers: "Pasageri",
      checkedBags: "Bagaje de cala",
      carryOn: "Bagaje de mana",
      wheelchairs: "Scaune rulante",
      childSeats: "Scaune copii",
      notes: "Note",
      accessible: "Accesibil",
      active: "Activ",
    },
    placeholders: {
      resource: "Cauta resurse...",
      resourceEmpty: "Nu exista resurse.",
      operator: "Cauta operatori...",
      operatorEmpty: "Nu exista operatori.",
    },
    errors: {
      resourceRequired: "ID-ul resursei este obligatoriu",
    },
    actions: {
      add: "Adauga vehicul",
    },
  },
}
