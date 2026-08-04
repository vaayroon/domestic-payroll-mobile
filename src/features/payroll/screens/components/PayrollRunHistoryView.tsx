/**
 * Presentational (props-only) list/loading/error/empty view for the
 * per-employee payroll run history (design ADR-5). Each row shows período
 * (`formatSpanishMonthYear`) + líquido a percibir (`formatEuros`); selecting
 * a row's "Generar recibo" action fires `onGenerate`, and a success banner
 * surfaces the resulting file `uri` once `lastUri` is set. Mirrors
 * `EmployeeListView.tsx`'s structure.
 */

import { FlatList, Pressable, Text, View } from 'react-native';

import type { PayrollRun } from '@/types';

import { formatSpanishMonthYear } from '../../formatSpanishDate';
import { formatEuros } from '../formatEuros';

export interface PayrollRunHistoryViewProps {
  readonly runs: PayrollRun[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly generating: boolean;
  readonly generateError: string | null;
  readonly lastUri: string | null;
  readonly onGenerate: (run: PayrollRun) => void;
}

export function PayrollRunHistoryView({
  runs,
  loading,
  error,
  generating,
  generateError,
  lastUri,
  onGenerate,
}: PayrollRunHistoryViewProps) {
  return (
    <View className="flex-1 bg-slate-900">
      <View className="p-4">
        <Text className="text-xl font-bold text-white">Historial de nóminas</Text>
      </View>

      {error !== null ? (
        <Text testID="payroll-run-history-error" className="px-4 text-red-400">
          {error}
        </Text>
      ) : null}

      {generateError !== null ? (
        <Text testID="payroll-run-history-generate-error" className="px-4 text-red-400">
          {generateError}
        </Text>
      ) : null}

      {lastUri !== null ? (
        <Text testID="payroll-run-history-success" className="px-4 text-emerald-400">
          {`Recibo generado: ${lastUri}`}
        </Text>
      ) : null}

      {loading ? (
        <Text testID="payroll-run-history-loading" className="px-4 text-slate-400">
          Cargando…
        </Text>
      ) : runs.length === 0 ? (
        <Text testID="payroll-run-history-empty" className="px-4 text-slate-400">
          Aún no hay nóminas generadas para este empleado.
        </Text>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(run) => run.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-slate-700 px-4 py-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">
                  {formatSpanishMonthYear(item.periodYear, item.periodMonth)}
                </Text>
                <Text className="text-sm text-slate-400">{formatEuros(item.netCents)}</Text>
              </View>
              <Pressable
                testID={`payroll-run-history-generate-${item.id}`}
                disabled={generating}
                onPress={() => onGenerate(item)}
              >
                <Text className={`font-semibold ${generating ? 'text-slate-500' : 'text-emerald-400'}`}>
                  {generating ? 'Generando…' : 'Generar recibo'}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
