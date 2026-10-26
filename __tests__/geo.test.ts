import { distanceInMeters, newlyEnteredZones, zonesContainingPoint } from '../src/services/geo';
import type { EnforcementZone } from '../src/data/zones';

const zone: EnforcementZone = {
  id: 'zone-a',
  name: 'Test area',
  center: { latitude: 6.5, longitude: 3.5 },
  radiusMeters: 500,
  vehicle: ['car', 'bus'],
  provenance: 'test fixture',
  publicationStatus: 'demo',
};

test('distance is zero at the same point and symmetric', () => {
  expect(distanceInMeters(zone.center, zone.center)).toBe(0);
  const other = { latitude: 6.51, longitude: 3.5 };
  expect(distanceInMeters(zone.center, other)).toBeCloseTo(distanceInMeters(other, zone.center), 8);
});

test('warning distance includes the boundary and filters vehicle type', () => {
  const atBoundary = { latitude: zone.center.latitude + 500 / 111_195, longitude: zone.center.longitude };
  expect(zonesContainingPoint(atBoundary, [zone], 'car', 500)).toHaveLength(1);
  expect(zonesContainingPoint(zone.center, [zone], 'motorcycle', 500)).toHaveLength(0);
  expect(zonesContainingPoint(atBoundary, [zone], 'car', 499)).toHaveLength(0);
});

test('zone entry alerts only on entry and alerts again after leaving and re-entering', () => {
  const firstEntry = newlyEnteredZones(new Set(), [zone]);
  expect(firstEntry).toEqual([zone]);
  expect(newlyEnteredZones(new Set(firstEntry.map((item) => item.id)), [zone])).toEqual([]);
  expect(newlyEnteredZones(new Set(), [zone])).toEqual([zone]);
});
