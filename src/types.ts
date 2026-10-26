export type Vehicle = 'car' | 'motorcycle' | 'bus';

export type Checkpoint = {
  id: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
  expiresAt: string;
  confirmations: number;
  vehicle: Vehicle[];
};

export type Law = {
  id: string;
  title: string;
  summary: string;
  fine: string;
  action?: string;
  vehicle: Vehicle[];
  source: string;
  sourceUrl?: string;
  effectiveDate?: string;
  reviewedAt?: string;
  reviewStatus: 'demo-unverified' | 'pending-review' | 'published';
  version: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};
