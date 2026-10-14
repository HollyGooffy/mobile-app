import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';
import { Alert, Pressable, Text, View } from 'react-native';

import type { MarkerImage } from '../model/types';

const StyledImage = cssInterop(Image, { className: 'style' });

type MarkerImageListProps = {
  images: MarkerImage[];
  onDelete: (imageId: number) => void;
};

export function MarkerImageList({ images, onDelete }: MarkerImageListProps) {
  if (images.length === 0) {
    return (
      <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 mb-8">
        <MaterialIcons color="#94a3b8" name="add-photo-alternate" size={42} />
        <Text className="mt-3 text-center text-base font-semibold text-slate-700">Изображений пока нет</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">Добавьте фотографию для этой точки</Text>
      </View>
    );
  }

  return (
    <View className="pb-8">
      {images.map((item) => (
        <View className="mb-3 flex-row items-center rounded-2xl bg-white p-3 shadow-sm" key={item.id}>
          <StyledImage className="h-20 w-20 rounded-xl bg-slate-100" contentFit="cover" source={{ uri: item.uri }} />
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-slate-800">Фотография</Text>
            <Text className="mt-1 text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString('ru-RU')}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Удалить изображение"
            className="h-11 w-11 items-center justify-center rounded-xl bg-red-50 active:bg-red-100"
            onPress={() =>
              Alert.alert('Удалить изображение?', 'Это действие нельзя отменить.', [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Удалить', style: 'destructive', onPress: () => onDelete(item.id) },
              ])
            }
          >
            <MaterialIcons color="#dc2626" name="delete-outline" size={23} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
