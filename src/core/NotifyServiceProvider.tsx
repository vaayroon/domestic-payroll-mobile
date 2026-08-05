/**
 * DI composition boundary for the notification scheduler (design D1).
 * Mirrors `PdfServiceProvider.tsx`'s pattern -- a sibling provider, not
 * folded into `Repositories`. Imports exclusively from `@/types`, never
 * `expo-notifications` directly; the concrete `ExpoNotificationScheduler` is
 * constructed once at the composition root (`src/app/_layout.tsx`) and
 * handed to `<NotifyServiceProvider>` as a prop.
 */

import { createContext, useContext, type ReactNode } from 'react';

import type { NotificationScheduler } from '@/types';

const NotifyServiceContext = createContext<NotificationScheduler | null>(null);

export function NotifyServiceProvider({
  scheduler,
  children,
}: {
  scheduler: NotificationScheduler;
  children: ReactNode;
}) {
  return <NotifyServiceContext.Provider value={scheduler}>{children}</NotifyServiceContext.Provider>;
}

export function useNotificationScheduler(): NotificationScheduler {
  const scheduler = useContext(NotifyServiceContext);
  if (!scheduler) {
    throw new Error('useNotificationScheduler must be called within a <NotifyServiceProvider>.');
  }
  return scheduler;
}
