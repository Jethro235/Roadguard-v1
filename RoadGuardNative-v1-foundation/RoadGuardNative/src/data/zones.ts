import { Coordinates } from '../types';

export type EnforcementZone = {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  speedLimitKmh: number;
  vehicle: Array<'car' | 'motorcycle' | 'bus'>;
};

export const ENFORCEMENT_ZONES: EnforcementZone[] = [
  {
    id: 'lekki-coastal-demo',
    name: 'Lekki / Coastal Highway demo zone',
    center: { latitude: 6.4654, longitude: 3.6016 },
    radiusMeters: 500,
    speedLimitKmh: 30,
    vehicle: ['car', 'motorcycle', 'bus'],
  },
];
