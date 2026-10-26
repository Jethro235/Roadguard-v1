import type { Law } from '../types';

export const LAWS: Law[] = [
  {
    id: 'speed-limits',
    title: 'Speed limits and safe driving',
    summary: 'Check posted signs and an authoritative, current traffic-law source before relying on a penalty or procedure.',
    fine: 'No verified fine published',
    vehicle: ['car', 'motorcycle', 'bus'],
    source: 'RoadGuard demo placeholder; legal review required',
    reviewStatus: 'demo-unverified',
    version: 1,
  },
  {
    id: 'turning-markings',
    title: 'Turning and road markings',
    summary: 'Follow signs, road markings, and instructions applicable to the road you are using.',
    fine: 'No verified fine published',
    vehicle: ['car', 'motorcycle', 'bus'],
    source: 'RoadGuard demo placeholder; legal review required',
    reviewStatus: 'demo-unverified',
    version: 1,
  },
  {
    id: 'overtaking-safely',
    title: 'Overtaking safely',
    summary: 'Only overtake when permitted by road signs and it is safe to do so.',
    fine: 'No verified fine published',
    vehicle: ['car', 'motorcycle', 'bus'],
    source: 'RoadGuard demo placeholder; legal review required',
    reviewStatus: 'demo-unverified',
    version: 1,
  },
];
