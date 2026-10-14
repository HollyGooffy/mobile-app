import type { Coordinates } from '../../../shared/model/geo';

export type MarkerImage = {
  id: number;
  markerId: number;
  uri: string;
  createdAt: string;
};

export type MapMarker = Coordinates & {
  id: number;
  title: string;
  createdAt: string;
  images: MarkerImage[];
};
