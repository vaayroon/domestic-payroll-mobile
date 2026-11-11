export const employees = {
  list: {
    title: 'Empleados',
    newPayrollRun: 'Nueva nómina',
    add: 'Añadir empleado',
    loading: 'Cargando…',
    empty: 'No hay empleados. Añade el primero.',
    errors: {
      read_failed: 'No se pudieron cargar los empleados.',
    },
    item: {
      history: 'Historial',
      edit: 'Editar',
      remove: 'Eliminar',
    },
  },
  edit: {
    loading: 'Cargando…',
    notFound: 'Empleado no encontrado.',
    errors: {
      read_failed: 'No se pudo cargar el empleado.',
    },
  },
  form: {
    submitCreate: 'Guardar',
    submitEdit: 'Guardar cambios',
    saving: 'Guardando…',
    saveFailed: 'No se pudo guardar: {{detail}}',
    labels: {
      name: 'Nombre',
      nif: 'NIF (opcional)',
      naf: 'NAF (opcional)',
      grupoCotizacion: 'Grupo de cotización (opcional)',
      baseGross: 'Salario bruto',
      alta: 'Fecha de alta (opcional)',
      baja: 'Fecha de baja (opcional)',
      contractType: 'Tipo de contrato',
      receiptEncryption: 'Proteger el recibo con contraseña',
      receiptPasswordOverride: 'Contraseña propia del recibo (opcional)',
      receiptFileName: 'Nombre del archivo del recibo',
    },
    placeholders: {
      name: 'Nombre del empleado',
      nif: 'NIF',
      naf: 'NAF',
      grupoCotizacion: 'Grupo de cotización',
      baseGross: '900,00',
      receiptPasswordOverride: 'Contraseña propia',
    },
    contractTypes: {
      INDEFINIDO: 'Indefinido',
      TEMPORAL: 'Temporal',
    },
    fileNameOptions: {
      inherit: 'Igual que el ajuste general',
      auto: 'Nombre automático',
    },
    helpers: {
      // The previous wording sent users to look for the group on their alta or IDC, where this
      // Sistema Especial does not put one: its base comes from the retribution tramo scale, not
      // from a contribution group (Orden PJC/297/2026 art. 15 never mentions "grupo", and
      // art. 34 bis of the Reglamento General sobre Cotización is derogado). Blank is the
      // expected value here, not a missing one.
      grupoCotizacion:
        'En el Sistema Especial de Empleados de Hogar la Tesorería General no suele asignar grupo de cotización: lo normal es dejarlo en blanco. Rellénalo solo si aparece en tu documentación de la Seguridad Social.',
      // The password only prevents ACCIDENTAL opening: an NIF/NIE is not a secret.
      receiptEncryption:
        'Protege el recibo con contraseña para evitar que se abra por descuido. No es una medida de seguridad fuerte: el NIF/NIE no es un secreto.',
      receiptPasswordOverride:
        'Si la dejas vacía, la contraseña será el NIF/NIE en mayúsculas, sin espacios ni guiones. Solo se admiten letras, números y símbolos básicos (sin acentos ni ñ), hasta {{max}} caracteres.',
      receiptFileName:
        'El nombre del archivo es visible al compartirlo o enviarlo, aunque el recibo esté protegido con contraseña.',
    },
    errors: {
      name: {
        required: 'El nombre es obligatorio.',
      },
      nif: {
        invalid: 'NIF/NIE no válido.',
      },
      naf: {
        invalid: 'NAF no válido.',
      },
      grupoCotizacion: {
        too_long: 'Usa como máximo 40 caracteres.',
      },
      baseGross: {
        empty: 'Introduce el salario bruto.',
        not_a_number: 'Introduce un número válido (ej. 900 o 900,50).',
        negative: 'El importe no puede ser negativo.',
        too_many_decimals: 'Usa como máximo dos decimales.',
        not_positive: 'El salario bruto debe ser mayor que cero.',
      },
      alta: {
        invalid_date: 'Introduce una fecha válida ({{hint}}).',
      },
      baja: {
        invalid_date: 'Introduce una fecha válida ({{hint}}).',
        before_alta: 'La fecha de baja no puede ser anterior a la fecha de alta.',
      },
      contractType: {
        required: 'Selecciona el tipo de contrato.',
      },
      receiptEncryptionEnabled: {
        password_unavailable:
          'Para proteger el recibo, indica el NIF/NIE del empleado o una contraseña propia.',
      },
      receiptPasswordOverride: {
        too_long: 'La contraseña es demasiado larga. Usa como máximo {{max}} caracteres.',
        invalid_characters:
          'La contraseña contiene caracteres no permitidos. Usa solo letras, números y símbolos básicos, sin acentos ni ñ.',
      },
    },
  },
} as const;
