import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';

import { useMarkers } from '../../../entities/marker';
import type { UserLocation } from '../../../shared/model/geo';
import {
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
  PROXIMITY_THRESHOLD_METERS,
} from '../config/tracking';
import { getProximityState } from '../lib/proximity';
import {
  addNotificationResponseListener,
  isExpoGo,
  NotificationPermissionError,
  ProximityNotificationManager,
  requestNotificationPermission,
} from '../lib/notifications';
import { startBackgroundLocationTracking } from './backgroundLocationTask.native';

export type TrackingStatus = 'checking' | 'granted' | 'denied' | 'error' | 'unavailable';

export type LocationContextValue = {
  location: UserLocation | null;
  locationStatus: TrackingStatus;
  notificationStatus: TrackingStatus;
  backgroundStatus: TrackingStatus;
  locationError: string | null;
  notificationError: string | null;
  backgroundError: string | null;
  nearbyCount: number;
  nearestDistance: number | null;
  retryPermissions: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function confirmBackgroundPermission() {
  if (Platform.OS !== 'android') return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Фоновая геолокация',
      'Чтобы уведомлять о приближении к меткам после сворачивания приложения, разрешите доступ к геолокации «Всегда» на следующем экране.',
      [
        { text: 'Не сейчас', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Продолжить', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

export function LocationProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { markers } = useMarkers();
  const markersRef = useRef(markers);
  const notificationManager = useMemo(() => new ProximityNotificationManager(db), [db]);
  const notificationsReady = useRef(false);
  const latestLocationRef = useRef<UserLocation | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<TrackingStatus>('checking');
  const [notificationStatus, setNotificationStatus] = useState<TrackingStatus>('checking');
  const [backgroundStatus, setBackgroundStatus] = useState<TrackingStatus>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    markersRef.current = markers;
    void notificationManager.reconcile(markers).catch((caught) => {
      if (__DEV__) console.warn('[Notifications] Не удалось синхронизировать метки:', caught);
    });
    if (location) {
      const proximity = getProximityState(location, markers, PROXIMITY_THRESHOLD_METERS);
      setNearbyCount(proximity.nearby.length);
      setNearestDistance(proximity.nearestDistance);
    }
  }, [location, markers, notificationManager]);

  useEffect(() => {
    let removeListener: (() => void) | undefined;
    void addNotificationResponseListener((markerId) => {
      router.push({ pathname: '/marker/[id]', params: { id: markerId } });
    })
      .then((remove) => {
        removeListener = remove;
      })
      .catch(() => undefined);
    return () => removeListener?.();
  }, []);

  useEffect(() => {
    let disposed = false;
    let locationSubscription: Location.LocationSubscription | undefined;

    const updateLocation = async (nextLocation: Location.LocationObject) => {
      if (disposed) return;
      const coordinates: UserLocation = {
        latitude: nextLocation.coords.latitude,
        longitude: nextLocation.coords.longitude,
        accuracy: nextLocation.coords.accuracy,
      };
      latestLocationRef.current = coordinates;
      setLocation(coordinates);
      setLocationStatus('granted');
      setLocationError(null);
      if (__DEV__) {
        console.info(
          `[Location] ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)} ±${Math.round(coordinates.accuracy ?? 0)} м`,
        );
      }

      const proximity = getProximityState(
        coordinates,
        markersRef.current,
        PROXIMITY_THRESHOLD_METERS,
      );
      setNearbyCount(proximity.nearby.length);
      setNearestDistance(proximity.nearestDistance);

      if (notificationsReady.current) {
        try {
          await notificationManager.update(
            coordinates,
            markersRef.current,
            PROXIMITY_THRESHOLD_METERS,
          );
          if (!disposed) setNotificationError(null);
        } catch (error) {
          if (!disposed) {
            setNotificationStatus('error');
            setNotificationError(getErrorMessage(error, 'Не удалось показать уведомление.'));
          }
        }
      }
    };

    const start = async () => {
      let foregroundPermissionGranted = false;
      notificationsReady.current = false;
      setLocationStatus('checking');
      setNotificationStatus('checking');
      setBackgroundStatus('checking');
      setLocationError(null);
      setNotificationError(null);
      setBackgroundError(null);
      latestLocationRef.current = null;
      setLocation(null);
      setNearbyCount(0);
      setNearestDistance(null);

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) throw new Error('Службы геолокации выключены на устройстве.');

        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!disposed) {
            setLocationStatus('denied');
            setLocationError('Доступ к местоположению запрещён.');
          }
        } else {
          foregroundPermissionGranted = true;
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: LOCATION_UPDATE_INTERVAL_MS,
              distanceInterval: LOCATION_UPDATE_DISTANCE_METERS,
            },
            (nextLocation) => void updateLocation(nextLocation),
            (reason) => {
              if (!disposed) {
                setLocationStatus('error');
                setLocationError(reason);
              }
            },
          );
          if (disposed) locationSubscription.remove();

          const lastKnownLocation = await Location.getLastKnownPositionAsync({
            maxAge: 60_000,
            requiredAccuracy: 1_000,
          });
          if (lastKnownLocation) await updateLocation(lastKnownLocation);

          void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
            .then(updateLocation)
            .catch((error) => {
              if (__DEV__) console.warn('[Location] Не удалось получить разовую позицию:', error);
            });
        }
      } catch (error) {
        if (!disposed) {
          setLocationStatus('error');
          setLocationError(getErrorMessage(error, 'Ошибка определения местоположения.'));
        }
      }

      try {
        await requestNotificationPermission();
        notificationsReady.current = true;
        if (!disposed) setNotificationStatus('granted');

        const latestLocation = latestLocationRef.current;
        if (latestLocation) {
          await notificationManager.update(
            latestLocation,
            markersRef.current,
            PROXIMITY_THRESHOLD_METERS,
          );
        }
      } catch (error) {
        notificationsReady.current = false;
        if (!disposed) {
          setNotificationStatus(error instanceof NotificationPermissionError ? 'denied' : 'error');
          setNotificationError(getErrorMessage(error, 'Ошибка настройки уведомлений.'));
        }
      }

      try {
        if (isExpoGo()) {
          if (!disposed) {
            setBackgroundStatus('unavailable');
            setBackgroundError('Фоновый GPS доступен только в development build.');
          }
          return;
        }

        if (!foregroundPermissionGranted) {
          if (!disposed) {
            setBackgroundStatus('denied');
            setBackgroundError('Сначала разрешите доступ к геолокации при использовании приложения.');
          }
          return;
        }

        let backgroundPermission = await Location.getBackgroundPermissionsAsync();
        if (!backgroundPermission.granted) {
          const shouldRequest = await confirmBackgroundPermission();
          if (!shouldRequest) {
            if (!disposed) {
              setBackgroundStatus('denied');
              setBackgroundError('Фоновый доступ к геолокации не разрешён.');
            }
            return;
          }
          backgroundPermission = await Location.requestBackgroundPermissionsAsync();
        }

        if (!backgroundPermission.granted) {
          if (!disposed) {
            setBackgroundStatus('denied');
            setBackgroundError('В настройках выберите доступ к геолокации «Всегда».');
          }
          return;
        }

        await startBackgroundLocationTracking();
        if (!disposed) {
          setBackgroundStatus('granted');
          setBackgroundError(null);
        }
      } catch (error) {
        if (!disposed) {
          setBackgroundStatus('error');
          setBackgroundError(getErrorMessage(error, 'Не удалось запустить фоновый GPS.'));
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      locationSubscription?.remove();
    };
  }, [notificationManager, retryKey]);

  const retryPermissions = useCallback(() => setRetryKey((current) => current + 1), []);
  const value = useMemo(
    () => ({
      location,
      locationStatus,
      notificationStatus,
      backgroundStatus,
      locationError,
      notificationError,
      backgroundError,
      nearbyCount,
      nearestDistance,
      retryPermissions,
    }),
    [
      location,
      locationStatus,
      notificationStatus,
      backgroundStatus,
      locationError,
      notificationError,
      backgroundError,
      nearbyCount,
      nearestDistance,
      retryPermissions,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationTracking() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocationTracking должен использоваться внутри LocationProvider.');
  return context;
}
