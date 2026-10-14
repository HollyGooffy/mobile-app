import type { SQLiteDatabase } from 'expo-sqlite';

import type { Coordinates } from '../../../shared/model/geo';
import type { MapMarker, MarkerImage } from '../model/types';

type MarkerRow = {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  created_at: string;
};

type MarkerImageRow = {
  id: number;
  marker_id: number;
  uri: string;
  created_at: string;
};

function toImage(row: MarkerImageRow): MarkerImage {
  return {
    id: row.id,
    markerId: row.marker_id,
    uri: row.uri,
    createdAt: row.created_at,
  };
}

function toMarker(row: MarkerRow, images: MarkerImage[] = []): MapMarker {
  return {
    id: row.id,
    title: row.title,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    images,
  };
}

export async function getAllMarkers(db: SQLiteDatabase): Promise<MapMarker[]> {
  const [markerRows, imageRows] = await Promise.all([
    db.getAllAsync<MarkerRow>('SELECT * FROM markers ORDER BY id ASC;'),
    db.getAllAsync<MarkerImageRow>('SELECT * FROM marker_images ORDER BY id ASC;'),
  ]);

  const imagesByMarker = new Map<number, MarkerImage[]>();
  for (const row of imageRows) {
    const images = imagesByMarker.get(row.marker_id) ?? [];
    images.push(toImage(row));
    imagesByMarker.set(row.marker_id, images);
  }

  return markerRows.map((row) => toMarker(row, imagesByMarker.get(row.id) ?? []));
}

export async function getMarkerImages(
  db: SQLiteDatabase,
  markerId: number,
): Promise<MarkerImage[]> {
  const rows = await db.getAllAsync<MarkerImageRow>(
    'SELECT * FROM marker_images WHERE marker_id = ? ORDER BY id ASC;',
    markerId,
  );
  return rows.map(toImage);
}

export async function insertMarker(
  db: SQLiteDatabase,
  coordinates: Coordinates,
  title: string,
): Promise<MapMarker> {
  const result = await db.runAsync(
    'INSERT INTO markers (title, latitude, longitude) VALUES (?, ?, ?);',
    title,
    coordinates.latitude,
    coordinates.longitude,
  );
  const row = await db.getFirstAsync<MarkerRow>('SELECT * FROM markers WHERE id = ?;', result.lastInsertRowId);

  if (!row) throw new Error('Созданная метка не найдена в базе данных.');
  return toMarker(row);
}

export async function removeMarker(db: SQLiteDatabase, markerId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('DELETE FROM markers WHERE id = ?;', markerId);
    if (result.changes === 0) throw new Error('Метка уже удалена или не существует.');
  });
}

export async function insertMarkerImage(
  db: SQLiteDatabase,
  markerId: number,
  uri: string,
): Promise<void> {
  await db.runAsync('INSERT INTO marker_images (marker_id, uri) VALUES (?, ?);', markerId, uri);
}

export async function removeMarkerImage(
  db: SQLiteDatabase,
  markerId: number,
  imageId: number,
): Promise<void> {
  const result = await db.runAsync(
    'DELETE FROM marker_images WHERE id = ? AND marker_id = ?;',
    imageId,
    markerId,
  );
  if (result.changes === 0) throw new Error('Изображение уже удалено или не существует.');
}
