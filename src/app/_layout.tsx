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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Keyboard Controller tracks the keyboard for `FormScrollView`.
    <KeyboardProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={runMigrations}>
        <DatabaseRepositories>
          <CurrentEmployerProvider>
            <PdfServiceProvider generator={pdfGenerator}>
              <MailServiceProvider pdfSharer={pdfSharer} mailSender={mailSender}>
                <NotifyServiceProvider scheduler={notificationScheduler}>
                  <SignaturePadProvider pad={SignaturePadView}>
                    <PdfViewerProvider viewer={PdfViewerView}>
                      <ReminderProvider>
                        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                          <Stack>
                            <Stack.Screen
                              name="index"
                              options={{
                                title: 'Empleados',
                                headerRight: () => (
                                  <Link href="/settings/employer" testID="header-settings-link">
                                    <Text className="text-emerald-400">Ajustes</Text>
                                  </Link>
                                ),
                              }}
                            />
                            <Stack.Screen
                              name="employees/new"
                              options={{ presentation: 'modal', title: 'Nuevo empleado' }}
                            />
                            <Stack.Screen
                              name="employees/[id]/edit"
                              options={{ presentation: 'modal', title: 'Editar empleado' }}
                            />
                            <Stack.Screen
                              name="payroll/new"
                              options={{ presentation: 'modal', title: 'Nueva nómina' }}
                            />
                            <Stack.Screen
                              name="payroll/history/[employeeId]"
                              options={{ title: 'Historial de nóminas' }}
                            />
                            <Stack.Screen
                              name="payroll/receipt/[employeeId]"
                              options={{ title: 'Recibo de salarios' }}
                            />
                            <Stack.Screen
                              name="settings/employer"
                              options={{ presentation: 'modal', title: 'Datos del empleador' }}
                            />
                            <Stack.Screen
                              name="settings/reminder"
                              options={{ presentation: 'modal', title: 'Recordatorio mensual' }}
                            />
                            <Stack.Screen
                              name="settings/signature"
                              options={{ presentation: 'modal', title: 'Firma' }}
                            />
                            <Stack.Screen
                              name="settings/receipt-file-name"
                              options={{ presentation: 'modal', title: 'Nombre del archivo' }}
                            />
                          </Stack>
                        </ThemeProvider>
                      </ReminderProvider>
                    </PdfViewerProvider>
                  </SignaturePadProvider>
                </NotifyServiceProvider>
              </MailServiceProvider>
            </PdfServiceProvider>
          </CurrentEmployerProvider>
        </DatabaseRepositories>
      </SQLiteProvider>
    </KeyboardProvider>
  );
}
