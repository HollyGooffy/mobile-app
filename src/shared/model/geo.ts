export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type UserLocation = Coordinates & {
  accuracy: number | null;
};
