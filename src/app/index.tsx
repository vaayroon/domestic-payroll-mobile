import { Text, View } from 'react-native';

// Trivial placeholder route. The real smoke screen (NativeWind render proof +
// DB round-trip) lands in a later apply batch — see `sdd/foundation/tasks`,
// Phase 4.
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-slate-900">
      <Text className="text-base text-slate-900 dark:text-white">
        Domestic Payroll — Foundation scaffold
      </Text>
    </View>
  );
}
