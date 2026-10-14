import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getAllMarkers,
  getMarkerImages,
  insertMarker,
  insertMarkerImage,
  removeMarker,
  removeMarkerImage,
} from '../api/markerRepository';
import type { Coordinates } from '../../../shared/model/geo';
import type { MapMarker, MarkerImage } from './types';

type MarkerContextValue = {
  markers: MapMarker[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  clearError: () => void;
  addMarker: (coordinates: Coordinates, title: string) => Promise<MapMarker>;
  deleteMarker: (markerId: number) => Promise<void>;
  addImage: (markerId: number, uri: string) => Promise<void>;
  deleteImage: (markerId: number, imageId: number) => Promise<void>;
  getImages: (markerId: number) => Promise<MarkerImage[]>;
  getMarker: (markerId: number) => MapMarker | undefined;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error('Неизвестная ошибка базы данных.');
}

export function MarkerProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      const result = await operation();
      setError(null);
      return result;
    } catch (caught) {
      const nextError = normalizeError(caught);
      setError(nextError);
      if (__DEV__) console.error('[SQLite]', nextError);
      throw nextError;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextMarkers = await run(() => getAllMarkers(db));
      setMarkers(nextMarkers);
    } finally {
      setIsLoading(false);
    }
  }, [db, run]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const addMarker = useCallback(
    async (coordinates: Coordinates, title: string) => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) throw new Error('Введите название метки.');
      if (normalizedTitle.length > 60) throw new Error('Название не должно быть длиннее 60 символов.');
      const marker = await run(() => insertMarker(db, coordinates, normalizedTitle));
      setMarkers((current) => [...current, marker]);
      return marker;
    },
    [db, run],
  );

  const deleteMarker = useCallback(
    async (markerId: number) => {
      await run(() => removeMarker(db, markerId));
      setMarkers((current) => current.filter((marker) => marker.id !== markerId));
    },
    [db, run],
  );

  const addImage = useCallback(
    async (markerId: number, uri: string) => {
      await run(() => insertMarkerImage(db, markerId, uri));
      const images = await run(() => getMarkerImages(db, markerId));
      setMarkers((current) =>
        current.map((marker) => (marker.id === markerId ? { ...marker, images } : marker)),
      );
    },
    [db, run],
  );

  const deleteImage = useCallback(
    async (markerId: number, imageId: number) => {
      await run(() => removeMarkerImage(db, markerId, imageId));
      setMarkers((current) =>
        current.map((marker) =>
          marker.id === markerId
            ? { ...marker, images: marker.images.filter((image) => image.id !== imageId) }
            : marker,
        ),
      );
    },
    [db, run],
  );

  const getImages = useCallback(
    (markerId: number) => run(() => getMarkerImages(db, markerId)),
    [db, run],
  );

  const getMarker = useCallback(
    (markerId: number) => markers.find((marker) => marker.id === markerId),
    [markers],
  );

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(
    () => ({
      markers,
      isLoading,
      error,
      refresh,
      clearError,
      addMarker,
      deleteMarker,
      addImage,
      deleteImage,
      getImages,
      getMarker,
    }),
    [
      markers,
      isLoading,
      error,
      refresh,
      clearError,
      addMarker,
      deleteMarker,
      addImage,
      deleteImage,
      getImages,
      getMarker,
    ],
  );

  return <MarkerContext.Provider value={value}>{children}</MarkerContext.Provider>;
}

export function useMarkers() {
  const context = useContext(MarkerContext);
  if (!context) throw new Error('useMarkers должен использоваться внутри MarkerProvider.');
  return context;
}
