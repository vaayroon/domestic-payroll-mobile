import type { TFunction } from 'i18next';

import type { ReminderCopy } from '@/types';

/**
 * Resolves the reminder's channel name, title and body from the active UI
 * language. The scheduler adapter never reads i18n itself (design D11): the
 * caller resolves the copy here and passes it in as arguments.
 */
export function getReminderCopy(t: TFunction): ReminderCopy {
  return {
    channelName: t(($) => $.reminder.notification.channelName),
    title: t(($) => $.reminder.notification.title),
    body: t(($) => $.reminder.notification.body),
  };
}
