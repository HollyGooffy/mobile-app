import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkerImageList, useMarkers } from '../../../entities/marker';

type MarkerRouteParams = {
  id: string;
};

const StyledSafeAreaView = cssInterop(SafeAreaView, { className: 'style' });

export function MarkerDetailsPage() {
  const params = useLocalSearchParams<MarkerRouteParams>();
  const rawMarkerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const markerId = Number(rawMarkerId);
  const { addImage, deleteImage, deleteMarker, getMarker, isLoading } = useMarkers();
  const [isPicking, setIsPicking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const marker = Number.isInteger(markerId) ? getMarker(markerId) : undefined;

  const pickImage = async () => {
    if (!marker) return;
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        await addImage(marker.id, result.assets[0].uri);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Не удалось выбрать изображение', message);
    } finally {
      setIsPicking(false);
    }
  };

  const confirmMarkerDeletion = () => {
    if (!marker || isDeleting) return;
    Alert.alert('Удалить метку?', 'Все связанные изображения также будут удалены из базы данных.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          setIsDeleting(true);
          void deleteMarker(marker.id)
            .then(() => router.replace('/'))
            .catch((caught) => {
              const message = caught instanceof Error ? caught.message : 'Неизвестная ошибка';
              Alert.alert('Не удалось удалить метку', message);
              setIsDeleting(false);
            });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <StyledSafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" size="large" />
        <Text className="mt-3 font-semibold text-slate-600">Загружаем метку…</Text>
      </StyledSafeAreaView>
    );
  }

  if (!marker) {
    return (
      <StyledSafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-8">
        <Ionicons color="#e11d48" name="location-outline" size={52} />
        <Text className="mt-4 text-center text-2xl font-extrabold text-slate-800">Метка не найдена</Text>
        <Text className="mt-2 text-center text-slate-500">Возможно, данные были сброшены после перезапуска.</Text>
        <Pressable className="mt-6 rounded-xl bg-blue-600 px-6 py-3 active:bg-blue-700" onPress={() => router.back()}>
          <Text className="font-bold text-white">Вернуться к карте</Text>
        </Pressable>
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-slate-100" edges={['top', 'bottom']}>
      <View className="flex-row items-center bg-slate-950 px-4 py-3">
        <Pressable
          accessibilityLabel="Вернуться назад"
          className="h-11 w-11 items-center justify-center rounded-full bg-slate-800 active:bg-slate-700"
          onPress={() => router.back()}
        >
          <Ionicons color="#ffffff" name="arrow-back" size={24} />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-xs font-bold tracking-[1.2px] text-amber-400">ДЕТАЛИ МЕТКИ</Text>
          <Text className="text-xl font-extrabold text-white">{marker.title}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <View className="rounded-2xl bg-white p-4 shadow-sm">
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
              <Ionicons color="#2563eb" name="navigate" size={23} />
            </View>
            <Text className="ml-3 text-lg font-bold text-slate-800">Координаты</Text>
          </View>
          <View className="mt-4 rounded-xl bg-slate-50 p-3">
            <Text className="text-sm text-slate-600">Широта</Text>
            <Text selectable className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {marker.latitude.toFixed(6)}
            </Text>
            <View className="my-3 h-px bg-slate-200" />
            <Text className="text-sm text-slate-600">Долгота</Text>
            <Text selectable className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {marker.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        <Pressable
          className={`my-4 flex-row items-center justify-center rounded-2xl py-4 ${
            isPicking ? 'bg-blue-300' : 'bg-blue-600 active:bg-blue-700'
          }`}
          disabled={isPicking}
          onPress={pickImage}
        >
          <Ionicons color="#ffffff" name="image" size={22} />
          <Text className="ml-2 text-base font-bold text-white">
            {isPicking ? 'Открываем галерею…' : 'Добавить изображение'}
          </Text>
        </Pressable>

        <View className="mb-3 flex-row items-end justify-between">
          <Text className="text-lg font-bold text-slate-800">Изображения</Text>
          <Text className="text-sm font-semibold text-slate-500">{marker.images.length}</Text>
        </View>

        <MarkerImageList
          images={marker.images}
          onDelete={(imageId) => {
            void deleteImage(marker.id, imageId).catch((caught) => {
              const message = caught instanceof Error ? caught.message : 'Неизвестная ошибка';
              Alert.alert('Не удалось удалить изображение', message);
            });
          }}
        />

        <Pressable
          className={`mb-8 flex-row items-center justify-center rounded-2xl border border-red-200 py-4 ${
            isDeleting ? 'bg-red-100' : 'bg-white active:bg-red-50'
          }`}
          disabled={isDeleting}
          onPress={confirmMarkerDeletion}
        >
          <Ionicons color="#dc2626" name="trash-outline" size={21} />
          <Text className="ml-2 font-bold text-red-600">
            {isDeleting ? 'Удаляем метку…' : 'Удалить метку'}
          </Text>
        </Pressable>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
