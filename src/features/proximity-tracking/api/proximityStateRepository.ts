import type { SQLiteDatabase } from 'expo-sqlite';

export type ActiveProximity = {
  markerId: number;
  notificationId: string | null;
};

type ActiveProximityRow = {
  marker_id: number;
  notification_id: string | null;
};

export async function claimProximityEntry(db: SQLiteDatabase, markerId: number) {
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO proximity_state (marker_id, notification_id) VALUES (?, NULL);',
    markerId,
  );
  return result.changes > 0;
}

export async function saveProximityNotification(
  db: SQLiteDatabase,
  markerId: number,
  notificationId: string,
) {
  await db.runAsync(
    'UPDATE proximity_state SET notification_id = ? WHERE marker_id = ?;',
    notificationId,
    markerId,
  );
}

export async function releaseProximityEntry(
  db: SQLiteDatabase,
  markerId: number,
): Promise<string | null> {
  const row = await db.getFirstAsync<ActiveProximityRow>(
    'SELECT marker_id, notification_id FROM proximity_state WHERE marker_id = ?;',
    markerId,
  );
  await db.runAsync('DELETE FROM proximity_state WHERE marker_id = ?;', markerId);
  return row?.notification_id ?? null;
}

export async function getActiveProximities(db: SQLiteDatabase): Promise<ActiveProximity[]> {
  const rows = await db.getAllAsync<ActiveProximityRow>(
    'SELECT marker_id, notification_id FROM proximity_state;',
  );
  return rows.map((row) => ({
    markerId: row.marker_id,
    notificationId: row.notification_id,
  }));
}
