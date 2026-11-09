export const employer = {
  settings: {
    loading: 'Cargando…',
    saving: 'Guardando…',
    submit: 'Guardar cambios',
    saveFailed: 'No se pudo guardar: {{detail}}',
    labels: {
      name: 'Nombre',
      nif: 'NIF/NIE (opcional)',
      address: 'Domicilio (opcional)',
      ccc: 'Nº cuenta cotización (opcional)',
      defaultLugar: 'Lugar de emisión (opcional)',
    },
    placeholders: {
      name: 'Nombre del empleador',
      nif: 'NIF/NIE',
      address: 'Domicilio',
      ccc: 'Nº S.S. / CCC',
      defaultLugar: 'Ciudad donde se emiten los recibos',
    },
    links: {
      reminder: 'Recordatorio mensual',
      signature: 'Firma de la parte empleadora',
      receiptFileName: 'Nombre del archivo del recibo',
    },
  },
  errors: {
    name: {
      required: 'El nombre es obligatorio.',
    },
    nif: {
      invalid_format: 'NIF/NIE con formato no válido.',
      invalid_checksum: 'La letra de control del NIF/NIE no es correcta.',
    },
    ccc: {
      invalid_format: 'El nº de cuenta de cotización debe tener 11 o 12 dígitos.',
    },
    load: {
      not_found: 'No se encontró el perfil del empleador.',
    },
  },
  signature: {
    loading: 'Cargando…',
    title: 'Firma de la parte empleadora',
    description:
      'Dibuja tu firma una sola vez. Se añadirá automáticamente a cada recibo que generes.',
    deviceOnly: 'La firma se guarda solo en este dispositivo.',
    status: {
      saved: 'Firma guardada',
      none: 'Sin firma guardada',
    },
    saving: 'Guardando…',
    save: 'Guardar firma',
    clear: 'Limpiar',
    delete: 'Borrar firma guardada',
    errors: {
      empty_canvas: 'Dibuja tu firma antes de guardar.',
      load_failed: 'No se pudo abrir el panel de firma.',
      capture_failed: 'No se pudo leer la firma.',
      save_failed: 'No se pudo guardar la firma.',
    },
  },
  receiptFileName: {
    loading: 'Cargando…',
    title: 'Nombre del archivo del recibo',
    helper:
      'El nombre del archivo es visible al compartirlo o enviarlo, aunque el recibo esté protegido con contraseña.',
    defaultOption: 'Nombre automático (aleatorio)',
    saving: 'Guardando…',
    submit: 'Guardar',
    errors: {
      save_failed: 'No se pudo guardar el ajuste.',
    },
  },
} as const;
