import type { Coordinates } from '../types';

export type EnforcementZone = {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  vehicle: Array<'car' | 'motorcycle' | 'bus'>;
  provenance: string;
  sourceUrl?: string;
  publicationStatus: 'demo' | 'published';
};

// This is only a synthetic illustration of proximity behavior. It is not an
// official enforcement location and must never be presented as one.
export const ENFORCEMENT_ZONES: EnforcementZone[] = [
  {
    id: 'demo-proximity-area',
    name: 'Demo proximity area',
    center: { latitude: 6.4654, longitude: 3.6016 },
    radiusMeters: 500,
    vehicle: ['car', 'motorcycle', 'bus'],
    provenance: 'Illustrative demo coordinate only; not an enforcement location',
    publicationStatus: 'demo',
  },
];
