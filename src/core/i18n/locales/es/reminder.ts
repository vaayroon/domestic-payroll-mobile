export const reminder = {
  notification: {
    channelName: 'Recordatorio de nómina',
    title: 'Recordatorio de nómina',
    body: 'Es hora de generar la nómina de este mes.',
  },
  screen: {
    loading: 'Cargando…',
    title: 'Recordatorio mensual',
    description: 'Recibe un aviso cada mes para generar la nómina de tus empleados de hogar.',
    toggleOn: 'Recordatorio activado',
    toggleOff: 'Activar recordatorio',
    dayOfMonth: 'Día del mes',
    time: 'Hora',
    deniedBanner:
      'Activa las notificaciones en los ajustes del sistema para recibir el recordatorio.',
    saveFailed: 'No se pudo guardar: {{detail}}',
    saving: 'Guardando…',
    submit: 'Guardar',
  },
} as const;
