import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';

import { useMarkers } from '../../../entities/marker';
import { useLocationTracking } from '../../../features/proximity-tracking';
import type { Coordinates } from '../../../shared/model/geo';
import { LabMap } from '../../../widgets/map';

const StyledSafeAreaView = cssInterop(SafeAreaView, { className: 'style' });

export function MapPage() {
  const { addMarker, error, isLoading, markers, refresh } = useMarkers();
  const {
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
  } = useLocationTracking();
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [pendingCoordinates, setPendingCoordinates] = useState<Coordinates>();
  const [markerTitle, setMarkerTitle] = useState('');
  const [isSavingMarker, setIsSavingMarker] = useState(false);
  const [centerOnUserRequest, setCenterOnUserRequest] = useState(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setLoadError(true), 10_000);
    return () => clearTimeout(timer);
  }, [isReady, mapKey]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const handleAddMarker = (coordinates: Coordinates) => {
    setPendingCoordinates(coordinates);
    setMarkerTitle('');
  };

  const closeNameDialog = () => {
    if (isSavingMarker) return;
    setPendingCoordinates(undefined);
    setMarkerTitle('');
  };

  const saveMarker = () => {
    const title = markerTitle.trim();
    if (!pendingCoordinates || !title || isSavingMarker) return;

    setIsSavingMarker(true);
    void addMarker(pendingCoordinates, title)
      .then((marker) => {
        setNotice(`${marker.title} добавлена и сохранена`);
        setPendingCoordinates(undefined);
        setMarkerTitle('');
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(undefined), 2400);
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : 'Неизвестная ошибка';
        Alert.alert('Не удалось сохранить метку', message);
      })
      .finally(() => {
        setIsSavingMarker(false);
      });
  };

  const retryMap = () => {
    setLoadError(false);
    setIsReady(false);
    setMapKey((current) => current + 1);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      <View className="flex-row items-center justify-between bg-slate-950 px-5 py-3">
        <View>
          <Text className="text-xl font-bold tracking-[1.5px] text-amber-400">MapLab</Text>
        </View>
        <View className="rounded-full bg-slate-800 px-3 py-2">
          <Text className="font-bold text-slate-200">{markers.length} меток</Text>
        </View>
      </View>

      <View className="flex-1 overflow-hidden">
        <LabMap
          key={mapKey}
          markers={markers}
          userLocation={location}
          centerOnUserRequest={centerOnUserRequest}
          onAddMarker={handleAddMarker}
          onMarkerPress={(id) => router.push({ pathname: '/marker/[id]', params: { id } })}
          onReady={() => {
            setIsReady(true);
            setLoadError(false);
          }}
        />

        {isLoading && (
          <View className="absolute inset-0 items-center justify-center bg-slate-100/90">
            <ActivityIndicator color="#2563eb" size="large" />
            <Text className="mt-3 font-semibold text-slate-700">Загружаем сохранённые метки…</Text>
          </View>
        )}

        {error && !isLoading && (
          <View className="absolute left-4 right-4 top-4 rounded-2xl bg-red-600 p-4 shadow-lg">
            <Text className="font-bold text-white">Ошибка базы данных</Text>
            <Text className="mt-1 text-sm text-red-50">{error.message}</Text>
            <Pressable className="mt-3 self-start rounded-lg bg-white px-4 py-2" onPress={() => void refresh()}>
              <Text className="font-bold text-red-700">Повторить</Text>
            </Pressable>
          </View>
        )}

        {!isReady && !loadError && (
          <View className="absolute inset-0 items-center justify-center bg-slate-100/90">
            <Text className="text-base font-semibold text-slate-700">Загружаем карту…</Text>
          </View>
        )}

        {loadError && (
          <View className="absolute inset-0 items-center justify-center bg-slate-100 px-8">
            <Ionicons color="#e11d48" name="cloud-offline-outline" size={48} />
            <Text className="mt-4 text-center text-xl font-bold text-slate-800">Карта не загрузилась</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              Проверьте подключение к интернету и попробуйте снова.
            </Text>
            <Pressable className="mt-5 rounded-xl bg-blue-600 px-6 py-3 active:bg-blue-700" onPress={retryMap}>
              <Text className="font-bold text-white">Повторить</Text>
            </Pressable>
          </View>
        )}

        {notice && (
          <View className="absolute left-4 right-4 top-4 rounded-2xl bg-emerald-600 px-4 py-3 shadow-lg">
            <Text className="text-center font-bold text-white">{notice}</Text>
          </View>
        )}

        <Pressable
          accessibilityLabel="Перейти к текущему местоположению"
          className={`absolute right-4 top-4 h-12 w-12 items-center justify-center rounded-2xl border-2 border-white shadow-lg ${
            location ? 'bg-blue-600 active:bg-blue-700' : 'bg-slate-400'
          }`}
          disabled={!location}
          onPress={() => setCenterOnUserRequest((current) => current + 1)}
        >
          <Ionicons color="#ffffff" name="locate" size={25} />
        </Pressable>

        <View className="absolute bottom-36 left-4 right-4 rounded-2xl bg-slate-900/95 px-4 py-3 shadow-lg">
          <View className="flex-row items-center">
            <Ionicons
              color={locationStatus === 'granted' ? '#34d399' : '#fbbf24'}
              name={locationStatus === 'granted' ? 'navigate-circle' : 'warning'}
              size={23}
            />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-white">
                {locationStatus === 'checking'
                  ? 'Ждём координаты GPS…'
                  : locationStatus === 'granted'
                    ? `GPS активен · рядом меток: ${nearbyCount}`
                    : 'GPS недоступен'}
              </Text>
              {locationStatus === 'granted' ? (
                <View className="mt-0.5">
                  <Text className="text-xs text-slate-300">
                    {location
                      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · точность ±${Math.round(location.accuracy ?? 0)} м`
                      : 'Координаты ещё не получены'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-300">
                    {nearestDistance === null
                      ? 'Нет сохранённых меток для сравнения'
                      : `Ближайшая метка: ${Math.round(nearestDistance)} м · уведомления: ${
                          notificationStatus === 'granted' ? 'включены' : 'выключены'
                        }`}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-300">
                    Фоновый GPS: {backgroundStatus === 'granted' ? 'включён' : 'выключен'}
                  </Text>
                </View>
              ) : (
                <Text className="mt-0.5 text-xs text-amber-100">
                  {locationError ?? notificationError ?? 'Ожидание разрешений'}
                </Text>
              )}
              {locationStatus === 'granted' && notificationStatus !== 'granted' && (
                <Text className="mt-1 text-xs text-amber-300">
                  {notificationError ?? 'Запрашиваем разрешение на уведомления…'}
                </Text>
              )}
              {backgroundStatus !== 'granted' && backgroundError && (
                <Text className="mt-1 text-xs text-amber-300">{backgroundError}</Text>
              )}
            </View>
            {(locationStatus === 'denied' ||
              locationStatus === 'error' ||
              notificationStatus === 'denied' ||
              notificationStatus === 'error' ||
              backgroundStatus === 'denied' ||
              backgroundStatus === 'error') && (
              <Pressable
                accessibilityLabel="Повторить запрос разрешений"
                className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600"
                onPress={retryPermissions}
              >
                <Ionicons color="#ffffff" name="refresh" size={20} />
              </Pressable>
            )}
          </View>
        </View>

        <View className="absolute bottom-5 left-4 right-4 rounded-2xl bg-white/95 p-4 shadow-lg">
          <View className="flex-row items-center justify-center">
            <Ionicons color="#2563eb" name="finger-print" size={21} />
            <Text className="ml-2 text-center text-sm font-semibold text-slate-700">
              Долгое нажатие — добавить маркер
            </Text>
          </View>
          <Text className="mt-1 text-center text-xs text-slate-500">Нажмите на маркер, чтобы открыть детали</Text>
          <Text className="mt-2 text-center text-[10px] text-slate-400">© OpenStreetMap contributors</Text>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeNameDialog}
        transparent
        visible={Boolean(pendingCoordinates)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center bg-slate-950/70 px-5"
        >
          <Pressable className="absolute inset-0" onPress={closeNameDialog} />
          <View className="rounded-3xl bg-white p-5 shadow-2xl">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <Ionicons color="#2563eb" name="location" size={23} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-xl font-extrabold text-slate-900">Название метки</Text>
                <Text className="mt-0.5 text-sm text-slate-500">До 60 символов</Text>
              </View>
            </View>

            <TextInput
              autoFocus
              className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900"
              editable={!isSavingMarker}
              maxLength={60}
              onChangeText={setMarkerTitle}
              onSubmitEditing={saveMarker}
              placeholder="Например, любимое кафе"
              placeholderTextColor="#94a3b8"
              returnKeyType="done"
              value={markerTitle}
            />

            <View className="mt-5 flex-row">
              <Pressable
                className="mr-2 flex-1 items-center rounded-xl bg-slate-100 py-3 active:bg-slate-200"
                disabled={isSavingMarker}
                onPress={closeNameDialog}
              >
                <Text className="font-bold text-slate-700">Отмена</Text>
              </Pressable>
              <Pressable
                className={`ml-2 flex-1 items-center rounded-xl py-3 ${
                  markerTitle.trim() && !isSavingMarker
                    ? 'bg-blue-600 active:bg-blue-700'
                    : 'bg-blue-300'
                }`}
                disabled={!markerTitle.trim() || isSavingMarker}
                onPress={saveMarker}
              >
                <Text className="font-bold text-white">
                  {isSavingMarker ? 'Сохраняем…' : 'Сохранить'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </StyledSafeAreaView>
  );
}
