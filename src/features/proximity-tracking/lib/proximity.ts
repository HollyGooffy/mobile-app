import type { MapMarker } from '../../../entities/marker/model/types';
import type { Coordinates } from '../../../shared/model/geo';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function calculateDistance(from: Coordinates, to: Coordinates) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getProximityState(
  location: Coordinates,
  markers: MapMarker[],
  thresholdMeters: number,
) {
  const distances = markers.map((marker) => ({
    marker,
    distance: calculateDistance(location, marker),
  }));

  return {
    nearby: distances.filter(({ distance }) => distance <= thresholdMeters),
    nearestDistance:
      distances.length > 0 ? Math.min(...distances.map(({ distance }) => distance)) : null,
  };
}
