/**
 * Root-level reconciliation of the OS-scheduled reminder against persisted
 * preferences (design D5). Mounted once at the composition root
 * (`src/app/_layout.tsx`), mirroring `CurrentEmployerProvider`'s root
 * placement -- unlike that provider, this one renders no UI and exposes no
 * context value; it is a pure side-effect coordinator.
 *
 * Reconciles on: mount, every `AppState` transition to `active`
 * (foreground), and every notification tap (live or cold-start, spec
 * TN-1/TN-2; cold-start is device-QA-verified, TN-3). All triggers funnel
 * through the SAME `reconcileReminder` helper so "what should currently be
 * scheduled" is decided in exactly one place -- the settings-save hook
 * reuses it too. The copy (channel name, title, body) is resolved from the
 * active UI language and passed in; a language change re-runs the
 * reconcile so the schedule follows it.
 *
 * Deliberately imports `@/features/reminder`'s pure domain/application
 * modules -- this is the one place in `core/` that depends on a feature
 * slice rather than the other way around. It does not create a cycle:
 * `features/reminder`'s domain/application layers depend on nothing in
 * `core/`, only `@/types`. Import those two sub-paths, never the
 * `@/features/reminder` barrel: the barrel also re-exports the screens,
 * which import `@/core` (enforced by `import/no-cycle`).
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';

import { reconcileReminder } from '@/features/reminder/application';
import { parseReminderPreferences, REMINDER_PREFERENCES_KEY } from '@/features/reminder/domain';

import { getReminderCopy, useTranslation } from './i18n';
import { useNotificationScheduler } from './NotifyServiceProvider';
import { useSettingsRepository } from './RepositoryProvider';

export function ReminderProvider({ children }: { children: ReactNode }) {
  const scheduler = useNotificationScheduler();
  const settings = useSettingsRepository();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // Reconcile runs are chained so at most one touches the scheduler at a time.
  // Without this, a run started under the old language (e.g. by a tap) could
  // still be inside `reconcileReminder` when a language switch starts a new
  // one, finish last, and leave the old-language copy scheduled. A run-id
  // check alone cannot help: the stale run may already be past it.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    function reconcile(): Promise<void> {
      const run = queueRef.current.then(async () => {
        // A run queued by an effect that has since been torn down (language
        // switch, new scheduler) is stale: the new effect queues its own run.
        if (cancelled) {
          return;
        }
        try {
          const raw = await settings.get(REMINDER_PREFERENCES_KEY);
          if (cancelled) {
            return;
          }
          const prefs = parseReminderPreferences(raw);
          await reconcileReminder(scheduler, prefs, new Date(), getReminderCopy(t));
        } catch {
          // Reconciliation must never crash the app; the settings screen owns
          // surfacing a denied-permission state to the user (design D5).
        }
      });
      queueRef.current = run;
      return run;
    }

    void reconcile();

    async function handleStartupTap() {
      const tapped = await scheduler.consumeStartupTap();
      if (tapped && !cancelled) {
        router.push('/payroll/new');
        void reconcile();
      }
    }
    void handleStartupTap();

    const unsubscribeTap = scheduler.onTap(() => {
      router.push('/payroll/new');
      void reconcile();
    });

    const appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        void reconcile();
      }
    });

    return () => {
      cancelled = true;
      unsubscribeTap();
      appStateSubscription.remove();
    };
    // `language` re-runs the effect on a language switch, so the pending
    // notification and the channel name are rewritten in the new language.
  }, [scheduler, settings, router, t, language]);

  return <>{children}</>;
}
