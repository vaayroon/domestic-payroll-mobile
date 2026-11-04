export const payroll = {
  form: {
    employee: 'Empleado',
    employeesLoading: 'Cargando empleados…',
    employeesEmpty: 'No hay empleados activos. Añade uno primero.',
    period: 'Periodo',
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
} as const;
