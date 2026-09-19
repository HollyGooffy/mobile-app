# Лабораторные №1–3: карта мест с SQLite, GPS и уведомлениями

Приложение на React Native, Expo SDK 57 и TypeScript объединяет интерактивную карту из первой лабораторной с постоянным локальным хранилищем из второй. Интерфейс оформлен NativeWind, `StyleSheet.create()` не используется.

## Возможности

- создание и именование метки долгим нажатием на карту;
- просмотр координат метки на отдельном экране `/marker/[id]`;
- добавление изображений из системной галереи;
- удаление отдельных изображений с подтверждением;
- удаление метки вместе со связанными записями изображений;
- сохранение меток и URI изображений после перезапуска приложения;
- отображение загрузки и ошибок базы данных с повторной загрузкой;
- версионирование и миграция схемы через `PRAGMA user_version`.
- отслеживание текущего положения пользователя, пока приложение активно;
- отображение положения и точности GPS на карте;
- расчёт расстояния до меток по формуле Хаверсина;
- локальное уведомление при входе в радиус 100 метров;
- защита от повторного уведомления, пока пользователь не покинет зону метки;
- отдельная обработка разрешений и ошибок GPS и уведомлений.

На Android и iOS карта отображается через Leaflet/OpenStreetMap внутри `react-native-webview`. Для неё не нужен Google Maps API key или billing. Браузерная версия проектом не поддерживается.

## Запуск

Требуются Node.js 22.13 или новее и Expo Go, совместимый с Expo SDK 57.

```sh
npm install
npm start
```

Полезные команды:

```sh
npm run start:clear
npm run android
npm run typecheck
npm run doctor
```

## Структура SQLite

База `places.db` содержит три таблицы:

```sql
CREATE TABLE markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marker_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marker_id INTEGER NOT NULL,
  uri TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (marker_id) REFERENCES markers(id) ON DELETE CASCADE
);

CREATE TABLE proximity_state (
  marker_id INTEGER PRIMARY KEY,
  notification_id TEXT,
  entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Индекс `idx_marker_images_marker_id` ускоряет выборку изображений конкретной метки. При открытии соединения включаются `WAL` и `foreign_keys`, поэтому удаление метки автоматически удаляет связанные записи из `marker_images`.

## Архитектура

Код организован по Feature-Sliced Design. Каталог Expo Router `src/app/` содержит только маршруты-адаптеры:

```text
src/
  app/                      # файловая маршрутизация Expo Router
  application/providers/    # композиция глобальных провайдеров
  pages/                     # страницы карты и деталей метки
  widgets/map/               # нативный виджет карты Leaflet/WebView
  features/proximity-tracking/ # GPS, расстояния и локальные уведомления
  entities/marker/           # модель метки, SQLite repository, store и UI изображений
  shared/                    # общие типы и инфраструктура SQLite
```

FSD-слой композиции назван `application`, потому что Expo Router резервирует `src/app` исключительно под файловые маршруты.

Основные точки входа:

- `src/shared/lib/database/schema.ts` — имя БД, версия и миграции;
- `src/entities/marker/api/markerRepository.ts` — типизированные SQL-операции;
- `src/entities/marker/model/MarkerProvider.tsx` — состояние меток и CRUD API;
- `src/features/proximity-tracking` — геолокация, расчёт расстояний и уведомления;
- `src/application/providers/AppProviders.tsx` — сборка SQLite, marker и location providers;
- `src/pages` — полноценные экраны приложения.

Все пользовательские значения передаются в SQL параметрами `?`, а не вставляются в строки запросов. Запись схемы и удаление метки выполняются в транзакциях. Ошибки операций переводятся в единый объект `Error`, сохраняются в контексте и выводятся пользователю; в режиме разработки также пишутся диагностические сообщения в консоль.

## Поведение данных

В базу сохраняются записи меток и URI выбранных изображений. Сам файл изображения остаётся под управлением системной медиатеки. Если пользователь удалит исходный файл или система отзовёт доступ, сохранённый URI может стать недоступным.

Для следующего изменения схемы нужно увеличить `DATABASE_VERSION` и добавить новый последовательный блок миграции в `src/shared/lib/database/schema.ts`. Откат при ошибке выполняется транзакцией автоматически.

## Геолокация и уведомления

`LocationProvider` запрашивает доступ к геолокации и использует `watchPositionAsync` с максимальной навигационной точностью, пока приложение активно. Для работы после сворачивания глобальная задача `expo-task-manager` запускается через `startLocationUpdatesAsync`: на Android она поддерживается foreground service, а на iOS — background location mode. Запрашиваемый интервал обновления — 1 секунда или перемещение минимум на 1 метр; фактическую частоту определяет операционная система и GPS-провайдер.

Для каждой новой позиции вычисляется расстояние до сохранённых меток. При входе в радиус 100 метров создаётся локальное уведомление. Состояние активных зон и идентификаторы уведомлений хранятся в таблице `proximity_state`, поэтому foreground/background обновления и перезапуск JS-процесса не создают дубликаты. После удаления дальше 130 метров зона сбрасывается и следующее приближение снова может показать уведомление; уже доставленное уведомление остаётся в системной шторке.

На Android в Expo Go для SDK 57 существует ошибка самого `expo-notifications`: статический импорт модуля может завершить приложение сообщением о недоступности push-уведомлений. Поэтому модуль загружается динамически только в development/production build. В Expo Go GPS, карта, расстояние и индикатор приближения продолжают работать, но системные уведомления помечаются как недоступные.

Для проверки полного сценария уведомлений используйте development build:

```sh
npx expo run:android
```

Для симуляции GPS в Android Emulator откройте Extended controls → Location, задайте координаты рядом с меткой и отправьте их устройству. Для фонового теста сверните приложение кнопкой Home, убедитесь, что Android показывает постоянное уведомление «Карта мест: GPS активен», затем отправьте координаты возле метки. Переместитесь дальше 130 метров и вернитесь обратно: новое уведомление должно появиться только после повторного входа в зону.

## Документация

- [Expo SQLite для SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo ImagePicker для SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Expo Router для SDK 57](https://docs.expo.dev/versions/v57.0.0/router/introduction/)
- [Expo Location для SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo Notifications для SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
