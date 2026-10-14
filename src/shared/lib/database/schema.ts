import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'places.db';
export const DATABASE_VERSION = 3;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Версия базы данных ${currentVersion} новее поддерживаемой ${DATABASE_VERSION}.`,
    );
  }

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS markers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS marker_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          marker_id INTEGER NOT NULL,
          uri TEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (marker_id) REFERENCES markers(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_marker_images_marker_id
          ON marker_images(marker_id);

      `);
      await db.execAsync('PRAGMA user_version = 1;');
    });
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE markers ADD COLUMN title TEXT NOT NULL DEFAULT '';
        UPDATE markers
          SET title = 'Метка №' || id
          WHERE TRIM(title) = '';
        PRAGMA user_version = 2;
      `);
    });
    currentVersion = 2;
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS proximity_state (
          marker_id INTEGER PRIMARY KEY,
          notification_id TEXT,
          entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        PRAGMA user_version = 3;
      `);
    });
  }

  if (__DEV__) {
    console.info(`[SQLite] База ${DATABASE_NAME} готова, версия ${DATABASE_VERSION}`);
  }
}
