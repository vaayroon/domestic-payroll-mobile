export const payroll = {
  form: {
    employee: 'Empleado',
    employeesLoading: 'Cargando empleados…',
    employeesEmpty: 'No hay empleados activos. Añade uno primero.',
    period: 'Periodo',
    periodPrevious: 'Mes anterior',
    periodNext: 'Mes siguiente',
    range: 'Rango de días trabajados',
    from: 'Desde',
    to: 'Hasta',
    extraPay: 'Pagas extra',
    extraPayModes: {
      INCLUDE_IN_MONTH: 'Incluir en el mes (junio/diciembre)',
      PRORATE: 'Prorratear cada mes',
      EXCLUDE: 'Excluir',
    },
    previewEmpty: 'Selecciona un empleado para ver la vista previa.',
    gross: 'Bruto:',
    ss: 'SS:',
    net: 'Neto:',
    prorated: 'Mes prorrateado.',
    saving: 'Guardando…',
    submit: 'Calcular y guardar nómina',
    errors: {
      range_invalid: 'La fecha de inicio no puede ser posterior a la fecha de fin.',
      rates_not_loaded:
        'No se han cargado las tarifas de cotización para este año. No se puede calcular la nómina.',
      select_employee: 'Selecciona un empleado.',
      duplicate_run: 'Ya existe una nómina para {{employee}} en {{month}}/{{year}}.',
    },
  },
  history: {
    title: 'Historial de nóminas',
    loading: 'Cargando…',
    empty: 'Aún no hay nóminas generadas para este empleado.',
    generate: 'Generar recibo',
    generating: 'Generando…',
    generated: 'Recibo generado.',
    open: 'Abrir recibo',
    share: 'Compartir',
    sendMail: 'Enviar por correo',
    encrypt: 'Cifrar',
    sent: 'Recibo enviado.',
    errors: {
      read_failed: 'No se pudo cargar el historial de nóminas.',
    },
  },
  protection: {
    generatedProtected: 'Recibo generado y protegido con contraseña.',
    hint: 'Recuerda indicar al empleado cómo abrir el recibo protegido.',
    viewerFailure:
      'No se pudo abrir el recibo protegido. Vuelve a generarlo desde el historial de nóminas.',
  },
  dispatch: {
    shareDialogTitle: 'Compartir recibo',
    mailUnavailable: 'No hay ninguna app de correo configurada en este dispositivo.',
    runMissing: 'No se encontró la nómina de este recibo.',
    errors: {
      share_failed: 'No se pudo compartir el recibo.',
      send_failed: 'No se pudo enviar el recibo.',
    },
  },
  generate: {
    errors: {
      employee_not_found: 'No se encontró el empleado de esta nómina.',
      employer_not_found: 'No se encontró el empleador.',
      encryption_unavailable:
        'No se puede cifrar: este empleado no tiene NIF/NIE ni contraseña propia. Añádelo en su ficha.',
      encryption_failed: 'No se pudo generar el recibo protegido. Inténtalo de nuevo.',
    },
  },
  viewer: {
    failure: 'No se pudo mostrar el recibo. Vuelve a generarlo desde el historial de nóminas.',
    pdfLabel: 'Recibo de salarios en PDF',
    loadingLabel: 'Cargando recibo',
    loading: 'Cargando recibo…',
  },
} as const;
