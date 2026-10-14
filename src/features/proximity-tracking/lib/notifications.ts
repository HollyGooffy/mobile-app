import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { MapMarker } from '../../../entities/marker/model/types';
import type { Coordinates } from '../../../shared/model/geo';
import {
  claimProximityEntry,
  getActiveProximities,
  releaseProximityEntry,
  saveProximityNotification,
} from '../api/proximityStateRepository';
import { PROXIMITY_EXIT_HYSTERESIS_METERS } from '../config/tracking';
import { calculateDistance, getProximityState } from './proximity';

const CHANNEL_ID = 'nearby-markers';
type NotificationsModule = typeof import('expo-notifications');
let notificationsPromise: Promise<NotificationsModule> | undefined;

export class NotificationPermissionError extends Error {}
export class NotificationRuntimeUnavailableError extends Error {}

export function isExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

async function getNotifications() {
  if (isExpoGo()) {
    throw new NotificationRuntimeUnavailableError(
      'В Expo Go для SDK 57 системные уведомления недоступны. Используйте development build.',
    );
  }
  notificationsPromise ??= import('expo-notifications');
  return notificationsPromise;
}

export async function requestNotificationPermission() {
  const Notifications = await getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Приближение к меткам',
      description: 'Уведомления при входе в радиус сохранённой метки',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#2563eb',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const result = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!result.granted) {
    throw new NotificationPermissionError('Уведомления запрещены. Разрешите их в настройках устройства.');
  }
}

export async function addNotificationResponseListener(
  listener: (markerId: number) => void,
) {
  const Notifications = await getNotifications();
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const markerId = response.notification.request.content.data?.markerId;
    if (typeof markerId === 'number') listener(markerId);
  });
  return () => subscription.remove();
}

export class ProximityNotificationManager {
  constructor(private readonly db: SQLiteDatabase) {}

  async update(location: Coordinates, markers: MapMarker[], thresholdMeters: number) {
    const state = getProximityState(location, markers, thresholdMeters);
    const markerDistances = new Map(
      markers.map((marker) => [marker.id, calculateDistance(location, marker)]),
    );
    const exitThresholdMeters = thresholdMeters + PROXIMITY_EXIT_HYSTERESIS_METERS;
    const active = await getActiveProximities(this.db);

    await Promise.all([
      ...state.nearby.map(({ marker, distance }) => this.enter(marker, distance)),
      ...active
        .filter(({ markerId }) => {
          const distance = markerDistances.get(markerId);
          return distance === undefined || distance > exitThresholdMeters;
        })
        .map(({ markerId }) => this.leave(markerId, false)),
    ]);

    return state;
  }

  async reconcile(markers: MapMarker[]) {
    const existingIds = new Set(markers.map((marker) => marker.id));
    await Promise.all(
      (await getActiveProximities(this.db))
        .filter(({ markerId }) => !existingIds.has(markerId))
        .map(({ markerId }) => this.leave(markerId, true)),
    );
  }

  async clear() {
    const active = await getActiveProximities(this.db);
    await Promise.all(active.map(({ markerId }) => this.leave(markerId, true)));
  }

  private async enter(marker: MapMarker, distance: number) {
    const claimed = await claimProximityEntry(this.db, marker.id);
    if (!claimed) return;

    try {
      const Notifications = await getNotifications();
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Вы рядом: ${marker.title}`,
          body: `До сохранённой метки примерно ${Math.max(1, Math.round(distance))} м.`,
          data: { markerId: marker.id },
          sound: true,
        },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      });
      await saveProximityNotification(this.db, marker.id, notificationId);
    } catch (error) {
      await releaseProximityEntry(this.db, marker.id);
      throw error;
    }
  }

  private async leave(markerId: number, dismissNotification: boolean) {
    const notificationId = await releaseProximityEntry(this.db, markerId);
    if (!dismissNotification || !notificationId) return;

    const Notifications = await getNotifications();
    await Promise.allSettled([
      Notifications.cancelScheduledNotificationAsync(notificationId),
      Notifications.dismissNotificationAsync(notificationId),
    ]);
  }
}
