/**
 * The single queue every reminder reconcile goes through, so the provider's
 * mount/foreground/tap/language runs and the settings screen's save never
 * touch the scheduler at the same time (otherwise the one finishing last
 * wins, whatever it read). `ReminderProvider` creates and provides it.
 *
 * Kept apart from `ReminderProvider.tsx` so `features/reminder` can use it
 * without importing the provider, which itself imports that feature.
 */

import { createContext, useContext } from 'react';

import type { SerialQueue } from './serialQueue';

/**
 * Outside a `ReminderProvider` (isolated hook tests) tasks run immediately,
 * which is the pre-queue behaviour.
 */
const runImmediately: SerialQueue = (task) => task();

export const ReminderReconcileQueueContext = createContext<SerialQueue>(runImmediately);

export function useReminderReconcileQueue(): SerialQueue {
  return useContext(ReminderReconcileQueueContext);
}
