import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, type PropsWithChildren } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { MarkerProvider } from '../../entities/marker';
import { LocationProvider } from '../../features/proximity-tracking';
import { DATABASE_NAME, migrateDatabase } from '../../shared/lib/database/schema';

function DatabaseFallback() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950">
      <ActivityIndicator color="#fbbf24" size="large" />
      <Text className="mt-3 font-semibold text-slate-200">Открываем базу данных…</Text>
    </View>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Suspense fallback={<DatabaseFallback />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase} useSuspense>
        <MarkerProvider>
          <LocationProvider>
            {children}
            <StatusBar style="light" />
          </LocationProvider>
        </MarkerProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
