import type { Catalog } from '../../catalog';
import type { reminder as es } from '../es/reminder';

export const reminder: Catalog<typeof es> = {
  notification: {
    channelName: 'Payroll reminder',
    title: 'Payroll reminder',
    body: "It's time to run this month's payroll.",
  },
  screen: {
    loading: 'Loading…',
    title: 'Monthly reminder',
    description: 'Get a notice every month to run the payroll for your household employees.',
    toggleOn: 'Reminder on',
    toggleOff: 'Turn on reminder',
    dayOfMonth: 'Day of the month',
    time: 'Time',
    deniedBanner: 'Turn on notifications in the system settings to receive the reminder.',
    saveFailed: 'Could not save: {{detail}}',
    saving: 'Saving…',
    submit: 'Save',
  },
};
