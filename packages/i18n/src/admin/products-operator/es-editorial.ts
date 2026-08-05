export const operatorAdminProductsMessagesEsEditorial = {
  sectionTitle: "Contenido editorial",
  sectionDescription:
    "El contenido del proveedor permanece en modo solo lectura. Las capas sustituyen lo que ven los clientes en el idioma seleccionado de la tienda.",
  localeLabel: "Idioma de la tienda",
  localeSourceSuffix: "idioma del proveedor",
  localeOverlaySuffix: "tiene capas",
  loadFailed: "No se ha podido cargar el contenido editorial.",
  retry: "Reintentar",
  loading: "Cargando el contenido editorial…",
  unavailable: "Las capas editoriales solo están disponibles para productos de origen externo.",
  readOnly: "No tienes permiso para editar el contenido editorial.",

  columnSource: "Origen del proveedor",
  columnOverlay: "Capa",
  columnEffective: "Efectivo (cliente)",
  compareLabel: "Comparar valores",

  stateExact: "Traducción del proveedor",
  stateLanguageFallback: "Alternativa por idioma",
  stateSourceFallback: "Alternativa del origen",
  stateOverlaid: "Con capa aplicada",
  stateOverlayOnly: "Traducción solo de la capa",
  stateMissing: "Ausente",
  stateInvalid: "Capa no válida",
  stateOrphaned: "Capa huérfana",
  stateMixed: "Mixto",
  stateDrifted: "El proveedor ha cambiado",
  driftedDescription:
    "El proveedor actualizó este contenido después de crearse la capa. Compara y después conserva, actualiza o elimina la capa.",
  invalidDescription:
    "Esta capa no supera la validación y se omite en las respuestas al cliente: {reason}",
  orphanedDescription:
    "El proveedor ya no proporciona este día del itinerario. La capa se conserva para revisión y no se aplica.",

  localeSummary: "Solicitado {requested} · proveedor {source} · servido {served}",
  noSourceValue: "Sin valor del proveedor",
  noOverlayValue: "Sin capa",
  noEffectiveValue: "Nada publicado",

  edit: "Editar",
  add: "Añadir traducción",
  save: "Guardar la capa",
  cancel: "Cancelar",
  saving: "Guardando…",
  clear: "Eliminar la capa",
  clearAll: "Eliminar las capas de este idioma",
  clearFieldTitle: "¿Eliminar esta capa?",
  clearFieldDescription:
    "La capa se elimina y los clientes vuelven a ver el valor actual del proveedor. El valor del proveedor nunca se copia en la capa.",
  clearLocaleTitle: "¿Eliminar todas las capas de {locale}?",
  clearLocaleDescription:
    "Se eliminarán las {count} capas de este idioma. Los clientes verán el contenido del proveedor.",
  confirm: "Eliminar",
  keepEditing: "Conservar",

  conflictTitle: "Otra persona ha guardado este campo antes",
  conflictDescription:
    "Tu versión {expected} está desactualizada (la actual es {current}). Vuelve a cargar el valor más reciente antes de guardar de nuevo.",
  reload: "Volver a cargar",
  saveFailed: "No se ha podido guardar la capa: {reason}",

  previewTitle: "Vista previa del cliente",
  previewShow: "Mostrar la vista previa del cliente",
  previewHide: "Ocultar la vista previa del cliente",
  previewNote: "Contenido efectivo que se sirve a los clientes en {locale}.",

  mediaSelect: "Elegir de la biblioteca multimedia",
  mediaReplace: "Sustituir la imagen",
  mediaRemoveOverlay: "Quitar la imagen de la capa",
  mediaPreviewAlt: "Imagen seleccionada",
  mediaNone: "Sin imagen",

  listAddItem: "Añadir elemento",
  listRemoveItem: "Quitar elemento",
  listItemLabel: "Elemento {index}",

  nodeRoot: "Producto",
  nodeDay: "Día {dayNumber}",

  fieldName: "Título",
  fieldDescription: "Descripción",
  fieldInclusions: "Incluye",
  fieldExclusions: "No incluye",
  fieldTerms: "Condiciones para el cliente",
  fieldHighlights: "Puntos destacados",
  fieldHeroImage: "Imagen principal",
  fieldGallery: "Galería",
  fieldDayTitle: "Título del día",
  fieldDayDescription: "Descripción del día",
  fieldDayHeroImage: "Imagen del día",
  fieldDayServices: "Servicios del día",

  authoredBy: "Última edición {when}",
  editorialNoteLabel: "Nota editorial",
  editorialNotePlaceholder: "Por qué existe esta capa (opcional)",
}
