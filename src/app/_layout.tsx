import { useMemo, type ReactNode } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { Link, Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Text } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import {
  CurrentEmployerProvider,
  MailServiceProvider,
  NotifyServiceProvider,
  PdfServiceProvider,
  PdfViewerProvider,
  ReminderProvider,
  RepositoryProvider,
  SignaturePadProvider,
  type Repositories,
} from '@/core';
import { LanguageProvider, useTranslation } from '@/core/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  createDatabase,
  DATABASE_NAME,
  EmployeeRepositoryDrizzle,
  EmployerRepositoryDrizzle,
  PayrollRunRepositoryDrizzle,
  runMigrations,
  SettingsRepositoryDrizzle,
} from '@/services/db';
import { ExpoMailSender, ExpoSharingPdfSharer } from '@/services/mail';
import { ExpoNotificationScheduler } from '@/services/notify';
import { ExpoPrintReceiptGenerator } from '@/services/pdf';
import { PdfViewerView } from '@/services/pdfviewer';
import { SignaturePadView } from '@/services/signature';

import '@/global.css';

/**
 * Composition root (task 3.8): the ONE place that constructs the concrete
 * `*RepositoryDrizzle` adapters from the live SQLite connection `SQLiteProvider`
 * just opened + migrated, and exposes them to the rest of the app as
 * interfaces via `RepositoryProvider`. `src/app/*` — unlike `core/` or
 * `features/*` — is allowed to import `@/services/db`; nowhere else does.
 */
// The PDF generator needs no DB connection, so it is constructed once at
// module scope rather than inside a component (design ADR-2). Same for the
// mail/share adapters (design ADR-4) — both are stateless.
const pdfGenerator = new ExpoPrintReceiptGenerator();
const pdfSharer = new ExpoSharingPdfSharer();
const mailSender = new ExpoMailSender();
const notificationScheduler = new ExpoNotificationScheduler();

function DatabaseRepositories({ children }: { children: ReactNode }) {
  const connection = useSQLiteContext();

  const repositories = useMemo<Repositories>(() => {
    const db = createDatabase(connection);
    return {
      employers: new EmployerRepositoryDrizzle(db, randomUUID, Date.now),
      employees: new EmployeeRepositoryDrizzle(db, randomUUID),
      payrollRuns: new PayrollRunRepositoryDrizzle(db, randomUUID, Date.now),
      settings: new SettingsRepositoryDrizzle(db),
    };
  }, [connection]);

  return <RepositoryProvider repositories={repositories}>{children}</RepositoryProvider>;
}

/** Stack with localized titles; re-renders when the UI language changes. */
function AppStack() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: t(($) => $.app.titles.employees),
          headerRight: () => (
            <Link href="/settings/employer" testID="header-settings-link">
              <Text className="text-emerald-400">{t(($) => $.app.settingsLink)}</Text>
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="employees/new"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.newEmployee) }}
      />
      <Stack.Screen
        name="employees/[id]/edit"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.editEmployee) }}
      />
      <Stack.Screen
        name="payroll/new"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.newPayroll) }}
      />
      <Stack.Screen
        name="payroll/history/[employeeId]"
        options={{ title: t(($) => $.app.titles.payrollHistory) }}
      />
      <Stack.Screen
        name="payroll/receipt/[employeeId]"
        options={{ title: t(($) => $.app.titles.receipt) }}
      />
      <Stack.Screen
        name="settings/employer"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.employerData) }}
      />
      <Stack.Screen
        name="settings/reminder"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.reminder) }}
      />
      <Stack.Screen
        name="settings/signature"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.signature) }}
      />
      <Stack.Screen
        name="settings/receipt-file-name"
        options={{ presentation: 'modal', title: t(($) => $.app.titles.receiptFileName) }}
      />
      <Stack.Screen
        name="settings/language"
        options={{ presentation: 'modal', title: t(($) => $.language.title) }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Keyboard Controller tracks the keyboard for `FormScrollView`.
    <KeyboardProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={runMigrations}>
        <DatabaseRepositories>
          <LanguageProvider>
            <CurrentEmployerProvider>
              <PdfServiceProvider generator={pdfGenerator}>
                <MailServiceProvider pdfSharer={pdfSharer} mailSender={mailSender}>
                  <NotifyServiceProvider scheduler={notificationScheduler}>
                    <SignaturePadProvider pad={SignaturePadView}>
                      <PdfViewerProvider viewer={PdfViewerView}>
                        <ReminderProvider>
                          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                            <AppStack />
                          </ThemeProvider>
                        </ReminderProvider>
                      </PdfViewerProvider>
                    </SignaturePadProvider>
                  </NotifyServiceProvider>
                </MailServiceProvider>
              </PdfServiceProvider>
            </CurrentEmployerProvider>
          </LanguageProvider>
        </DatabaseRepositories>
      </SQLiteProvider>
    </KeyboardProvider>
  );
}
