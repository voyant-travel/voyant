import type { ProductsUiMessages } from "./messages"

export const productsUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
    create: "Creeaza",
    add: "Adauga",
    loading: "Se incarca...",
    none: "—",
    previous: "Anterior",
    next: "Urmator",
    page: "Pagina",
    active: "Activ",
    inactive: "Inactiv",
    mediaTypeLabels: {
      image: "Imagine",
      video: "Video",
      document: "Document",
    },
    optionUnitTypeLabels: {
      person: "Persoana",
      group: "Grup",
      room: "Camera",
      vehicle: "Vehicul",
      service: "Serviciu",
      other: "Altul",
    },
    optionStatusLabels: {
      draft: "Ciorna",
      active: "Activ",
      archived: "Arhivat",
    },
  },
  comboboxes: {
    productCategory: {
      placeholder: "Cauta categoria parinte...",
      empty: "Nu au fost gasite categorii de produs.",
    },
    productType: {
      placeholder: "Cauta tipuri de produs...",
      empty: "Nu au fost gasite tipuri de produs.",
    },
  },
  productCategoryDialog: {
    titles: {
      create: "Categorie noua de produs",
      edit: "Editeaza categoria de produs",
    },
    descriptions: {
      create: "Creeaza o categorie pentru organizarea catalogului de produse.",
      edit: "Actualizeaza ierarhia categoriei, slug-ul si starea activa.",
    },
  },
  productCategoryForm: {
    fields: {
      name: "Nume",
      slug: "Slug",
      parentCategory: "Categorie parinte",
      description: "Descriere",
      sortOrder: "Ordine sortare",
      active: "Activ",
    },
    placeholders: {
      name: "Aventura",
      slug: "aventura",
      parentCategory: "Cauta categoria parinte...",
      description: "Descrierea categoriei...",
    },
    validation: {
      nameRequired: "Numele categoriei este obligatoriu.",
      slugRequired: "Slug-ul categoriei este obligatoriu.",
      saveFailed: "Salvarea categoriei de produs a esuat.",
    },
    actions: {
      createCategory: "Creeaza categoria",
    },
  },
  productCategoryList: {
    searchPlaceholder: "Cauta categorii de produs...",
    addCategory: "Adauga categoria",
    columns: {
      name: "Nume",
      slug: "Slug",
      parent: "Parinte",
      status: "Status",
      actions: "Actiuni",
    },
    loadingError: "Incarcarea categoriilor de produs a esuat.",
    empty: "Nu au fost gasite categorii de produs.",
    edit: "Editeaza",
    delete: "Sterge",
    deleteConfirm: "Stergi aceasta categorie de produs?",
    showingSummary: "Afisezi {count} din {total}",
  },
  productTagDialog: {
    titles: {
      create: "Tag nou de produs",
      edit: "Editeaza tag-ul de produs",
    },
    descriptions: {
      create: "Creeaza un tag reutilizabil pentru filtrare si clasificare.",
      edit: "Actualizeaza tag-ul folosit pentru etichetarea si filtrarea produselor.",
    },
  },
  productTagForm: {
    fields: {
      name: "Nume",
    },
    placeholders: {
      name: "Potrivit pentru familie",
    },
    validation: {
      nameRequired: "Numele tag-ului este obligatoriu.",
      saveFailed: "Salvarea tag-ului de produs a esuat.",
    },
    actions: {
      createTag: "Creeaza tag-ul",
    },
  },
  productTagList: {
    searchPlaceholder: "Cauta tag-uri de produs...",
    addTag: "Adauga tag",
    columns: {
      name: "Nume",
      actions: "Actiuni",
    },
    loadingError: "Incarcarea tag-urilor de produs a esuat.",
    empty: "Nu au fost gasite tag-uri de produs.",
    edit: "Editeaza",
    delete: "Sterge",
    deleteConfirm: "Stergi acest tag de produs?",
    showingSummary: "Afisezi {count} din {total}",
  },
  productMediaDialog: {
    titles: {
      create: "Adauga media",
      edit: "Editeaza media",
    },
    descriptions: {
      create: "Inregistreaza un element media la nivel de produs sau zi prin URL.",
      edit: "Actualizeaza metadatele, ordinea si comportamentul de cover pentru acest element media.",
    },
  },
  productMediaForm: {
    fields: {
      mediaType: "Tip media",
      name: "Nume",
      url: "URL",
      storageKey: "Cheie stocare",
      mimeType: "Tip MIME",
      fileSize: "Dimensiune fisier",
      sortOrder: "Ordine sortare",
      coverMedia: "Media cover",
      altText: "Text alternativ",
    },
    placeholders: {
      name: "Imagine hero",
      url: "https://example.com/media/hero.jpg",
      mimeType: "image/jpeg",
      altText: "Scurta descriere de accesibilitate",
    },
    validation: {
      nameRequired: "Numele media este obligatoriu.",
      urlRequired: "URL-ul media este obligatoriu.",
      saveFailed: "Salvarea media a esuat.",
    },
    actions: {
      addMedia: "Adauga media",
      saveMedia: "Salveaza media",
    },
  },
  productMediaSection: {
    titles: {
      media: "Media",
      dayMedia: "Media zi",
    },
    descriptions: {
      media: "Gestioneaza activele media la nivel de produs si selectia de cover.",
      dayMedia: "Gestioneaza media atasata acestei zile din itinerar.",
    },
    actions: {
      upload: "Incarca",
      addMedia: "Adauga media",
      markCover: "Seteaza cover",
      edit: "Editeaza",
      delete: "Sterge",
    },
    loadingError: "Incarcarea media a esuat.",
    empty: "Nu exista inca elemente media configurate.",
    uploadFailed: "Incarcarea media a esuat.",
    deleteConfirm: "Stergi acest element media?",
    coverBadge: "Cover",
    columns: {
      name: "Nume",
      type: "Tip",
      url: "URL",
      sort: "Ordine",
    },
  },
  productDayDialog: {
    titles: {
      create: "Adauga zi de itinerar",
      edit: "Editeaza ziua de itinerar",
    },
    descriptions: {
      create: "Creeaza o zi structurata in itinerarul produsului.",
      edit: "Actualizeaza titlul, locatia si prezentarea acestei zile.",
    },
  },
  productDayForm: {
    fields: {
      dayNumber: "Numar zi",
      location: "Locatie",
      title: "Titlu",
      description: "Descriere",
    },
    placeholders: {
      location: "Dubrovnik",
      title: "Sosire in Dubrovnik",
      description: "Prezentare si activitati pentru aceasta zi",
    },
    validation: {
      dayNumberMin: "Numarul zilei trebuie sa fie cel putin 1.",
      saveFailed: "Salvarea zilei a esuat.",
    },
    actions: {
      addDay: "Adauga zi",
      saveDay: "Salveaza ziua",
    },
  },
  productDayServiceForm: {
    fields: {
      supplierService: "Serviciu furnizor",
      serviceType: "Tip serviciu",
      countryCode: "Cod tara",
      name: "Nume",
      description: "Descriere",
      costCurrency: "Moneda",
      costAmount: "Cost",
      quantity: "Cantitate",
      sortOrder: "Ordine sortare",
      notes: "Note",
    },
    placeholders: {
      supplierService: "ID serviciu furnizor optional",
      countryCode: "RO",
      name: "Cazare hotel",
      description: "Detalii operationale ale serviciului",
      notes: "Note interne",
    },
    serviceTypes: {
      accommodation: "Cazare",
      transfer: "Transfer",
      experience: "Experienta",
      guide: "Ghid",
      meal: "Masa",
      other: "Altul",
    },
    validation: {
      nameRequired: "Numele serviciului este obligatoriu.",
      currencyRequired: "Moneda trebuie sa fie un cod ISO din 3 litere.",
      costNonNegative: "Costul trebuie sa fie zero sau mai mare.",
      quantityMin: "Cantitatea trebuie sa fie cel putin 1.",
      saveFailed: "Salvarea serviciului a esuat.",
    },
    actions: {
      addService: "Adauga serviciu",
      saveService: "Salveaza serviciul",
    },
  },
  productItineraryDayRow: {
    dayLabel: "Ziua {dayNumber}",
    emptyServices: "Nu exista servicii configurate pentru aceasta zi.",
    servicesLoadingError: "Incarcarea serviciilor zilei a esuat.",
    columns: {
      name: "Nume",
      type: "Tip",
      cost: "Cost",
      quantity: "Cantitate",
    },
  },
  productItineraryDialog: {
    titles: {
      create: "Itinerar nou",
      edit: "Redenumeste itinerarul",
    },
    descriptions: {
      create: "Adauga o alta varianta de itinerar pentru acest produs.",
      edit: "Actualizeaza numele itinerarului si starea implicita.",
    },
    fields: {
      name: "Nume",
      defaultItinerary: "Seteaza ca itinerar implicit",
      notesDefaultLocked:
        "Acesta este itinerarul implicit. Seteaza alt itinerar ca implicit pentru a-l schimba.",
      notesFirstDefault: "Primul itinerar este automat cel implicit.",
    },
    placeholders: {
      name: "ex. Itinerar principal, Varianta familie",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
      saveFailed: "Salvarea itinerarului a esuat.",
    },
    actions: {
      createItinerary: "Creeaza itinerarul",
    },
  },
  optionUnitDialog: {
    titles: {
      create: "Unitate noua pentru optiune",
      edit: "Editeaza unitatea optiunii",
    },
    descriptions: {
      create: "Creeaza o unitate selectabila sub aceasta optiune.",
      edit: "Actualizeaza constrangerile unitatii, limitele de cantitate si regulile de ocupare.",
    },
  },
  optionUnitForm: {
    fields: {
      name: "Nume",
      code: "Cod",
      unitType: "Tip unitate",
      sortOrder: "Ordine sortare",
      minQuantity: "Cantitate minima",
      maxQuantity: "Cantitate maxima",
      minAge: "Varsta minima",
      maxAge: "Varsta maxima",
      occupancyMin: "Ocupare minima",
      occupancyMax: "Ocupare maxima",
      description: "Descriere",
      required: "Obligatoriu",
      hidden: "Ascuns",
    },
    placeholders: {
      name: "Adult",
      code: "adult",
      description: "Descriere optionala a unitatii",
    },
    validation: {
      nameRequired: "Numele unitatii este obligatoriu.",
      saveFailed: "Salvarea unitatii optiunii a esuat.",
    },
    actions: {
      createUnit: "Creeaza unitatea",
    },
  },
  productVersionDialog: {
    title: "Creeaza snapshot de versiune",
    description:
      "Salveaza starea curenta a produsului, inclusiv itinerarul si structura optiunilor, ca versiune noua.",
    fields: {
      notes: "Note",
    },
    placeholders: {
      notes: "Ce s-a schimbat in aceasta versiune?",
    },
    validation: {
      saveFailed: "Crearea snapshot-ului de versiune a esuat.",
    },
    actions: {
      createVersion: "Creeaza versiunea",
    },
  },
  productVersionsSection: {
    titles: {
      default: "Versiuni",
    },
    descriptions: {
      default: "Creeaza si navigheaza snapshot-uri imuabile ale produsului.",
    },
    actions: {
      createVersion: "Creeaza versiunea",
    },
    loadingError: "Incarcarea versiunilor produsului a esuat.",
    empty: "Nu exista inca snapshot-uri de versiune.",
    versionLabel: "Versiunea",
  },
  productOptionDialog: {
    titles: {
      create: "Optiune noua",
      edit: "Editeaza optiunea",
    },
    descriptions: {
      create: "Creeaza o optiune reutilizabila sub acest produs.",
      edit: "Actualizeaza disponibilitatea optiunii, ordonarea si comportamentul implicit.",
    },
  },
  productOptionForm: {
    fields: {
      name: "Nume",
      code: "Cod",
      description: "Descriere",
      status: "Status",
      sortOrder: "Ordine sortare",
      availableFrom: "Disponibil de la",
      availableTo: "Disponibil pana la",
      defaultOption: "Optiune implicita",
    },
    placeholders: {
      name: "Camera single",
      code: "camera-single",
      description: "Descriere optionala a optiunii",
      availableFrom: "Selecteaza data de inceput",
      availableTo: "Selecteaza data de sfarsit",
    },
    validation: {
      nameRequired: "Numele optiunii este obligatoriu.",
      saveFailed: "Salvarea optiunii de produs a esuat.",
    },
    actions: {
      createOption: "Creeaza optiunea",
    },
  },
  productOptionsSection: {
    titles: {
      default: "Optiuni si unitati",
      units: "Unitati",
    },
    descriptions: {
      default: "Gestioneaza variantele de optiuni si unitatile disponibile sub fiecare optiune.",
      units: "Configureaza unitatile selectabile care apartin acestei optiuni.",
    },
    actions: {
      addOption: "Adauga optiune",
      addUnit: "Adauga unitate",
      duplicate: "Duplica optiunea",
      edit: "Editeaza",
      delete: "Sterge",
    },
    loadingError: {
      options: "Incarcarea optiunilor produsului a esuat.",
      units: "Incarcarea unitatilor optiunii a esuat.",
    },
    empty: {
      options: "Nu exista optiuni configurate pentru acest produs.",
      units: "Nu exista unitati configurate pentru aceasta optiune.",
    },
    deleteConfirm: {
      option: 'Stergi optiunea "{name}" si toate unitatile ei?',
      unit: 'Stergi unitatea "{name}"?',
    },
    columns: {
      unitType: "Tip",
      unitName: "Nume",
      quantity: "Cantitate",
      age: "Varsta",
      occupancy: "Ocupare",
      actions: "Actiuni",
    },
    badges: {
      defaultOption: "Implicita",
    },
  },
} satisfies ProductsUiMessages
