import type { Coordinates } from '../types';
import type { EnforcementZone } from '../data/zones';

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceInMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function zonesContainingPoint(
  point: Coordinates,
  zones: EnforcementZone[],
  vehicle: 'car' | 'motorcycle' | 'bus',
  warningDistanceMeters: number,
): EnforcementZone[] {
  return zones.filter(
    (zone) =>
      zone.vehicle.includes(vehicle) &&
      distanceInMeters(point, zone.center) <= warningDistanceMeters,
  );
}

export function newlyEnteredZones(
  previousZoneIds: ReadonlySet<string>,
  currentZones: EnforcementZone[],
): EnforcementZone[] {
  return currentZones.filter((zone) => !previousZoneIds.has(zone.id));
}
