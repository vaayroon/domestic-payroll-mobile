import { useMemo, type ReactNode } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

import { CurrentEmployerProvider, PdfServiceProvider, RepositoryProvider, type Repositories } from '@/core';
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
import { ExpoPrintReceiptGenerator } from '@/services/pdf';

import '@/global.css';

/**
 * Composition root (task 3.8): the ONE place that constructs the concrete
 * `*RepositoryDrizzle` adapters from the live SQLite connection `SQLiteProvider`
 * just opened + migrated, and exposes them to the rest of the app as
 * interfaces via `RepositoryProvider`. `src/app/*` — unlike `core/` or
 * `features/*` — is allowed to import `@/services/db`; nowhere else does.
 */
// The PDF generator needs no DB connection, so it is constructed once at
// module scope rather than inside a component (design ADR-2).
const pdfGenerator = new ExpoPrintReceiptGenerator();

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
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={runMigrations}>
      <DatabaseRepositories>
        <CurrentEmployerProvider>
          <PdfServiceProvider generator={pdfGenerator}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ title: 'Empleados' }} />
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
              </Stack>
            </ThemeProvider>
          </PdfServiceProvider>
        </CurrentEmployerProvider>
      </DatabaseRepositories>
    </SQLiteProvider>
  );
}
