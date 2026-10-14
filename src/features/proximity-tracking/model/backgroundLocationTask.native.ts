import * as Location from 'expo-location';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { getAllMarkers } from '../../../entities/marker/api/markerRepository';
import { DATABASE_NAME, migrateDatabase } from '../../../shared/lib/database/schema';
import type { UserLocation } from '../../../shared/model/geo';
import {
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
  PROXIMITY_THRESHOLD_METERS,
} from '../config/tracking';
import { ProximityNotificationManager } from '../lib/notifications';

export const BACKGROUND_LOCATION_TASK = 'map-places-background-location';

type BackgroundLocationData = {
  locations: Location.LocationObject[];
};

let backgroundDatabasePromise: Promise<SQLiteDatabase> | null = null;

function getBackgroundDatabase() {
  if (!backgroundDatabasePromise) {
    backgroundDatabasePromise = openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await migrateDatabase(db);
        return db;
      })
      .catch((error) => {
        backgroundDatabasePromise = null;
        throw error;
      });
  }

  return backgroundDatabasePromise;
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<BackgroundLocationData>(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        console.error('[BackgroundLocation]', error.message);
        return;
      }

      const locations = data?.locations ?? [];
      if (locations.length === 0) return;

      const db = await getBackgroundDatabase();
      try {
        const markers = await getAllMarkers(db);
        const notificationManager = new ProximityNotificationManager(db);
        let latestCoordinates: UserLocation | null = null;

        // A background event may contain several route points. Processing only
        // the last one can skip a short proximity zone at higher playback speeds.
        for (const location of locations) {
          latestCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
          };
          await notificationManager.update(
            latestCoordinates,
            markers,
            PROXIMITY_THRESHOLD_METERS,
          );
        }

        if (__DEV__ && latestCoordinates) {
          console.info(
            `[BackgroundLocation] ${latestCoordinates.latitude.toFixed(6)}, ${latestCoordinates.longitude.toFixed(6)} (${locations.length} точек)`,
          );
        }
      } catch (caught) {
        console.error('[BackgroundLocation] Не удалось обработать координаты:', caught);
      }
    },
  );
}

export async function startBackgroundLocationTracking() {
  const available = await TaskManager.isAvailableAsync();
  if (!available) throw new Error('Фоновая геолокация недоступна в Expo Go. Используйте development build.');

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    // High keeps the GPS provider active after the app is backgrounded.
    // Balanced may fall back to infrequent network fixes on Android.
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: LOCATION_UPDATE_INTERVAL_MS,
    distanceInterval: LOCATION_UPDATE_DISTANCE_METERS,
    deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL_MS,
    deferredUpdatesDistance: LOCATION_UPDATE_DISTANCE_METERS,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Карта мест: GPS активен',
      notificationBody: 'Отслеживаем приближение к сохранённым меткам',
      notificationColor: '#2563eb',
      killServiceOnDestroy: false,
    },
  });
}
