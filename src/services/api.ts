import type { Checkpoint, Law, Vehicle } from '../types';
import type { EnforcementZone } from '../data/zones';

export type PublicRoadData = { laws: Law[]; zones: EnforcementZone[] };

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`RoadGuard API returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  const parsed = new URL(trimmed);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('API URLs cannot contain embedded credentials, query parameters, or fragments.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '10.0.2.2') {
    throw new Error('Use HTTPS for a remote API. HTTP is allowed only for localhost/emulator development.');
  }
  return trimmed;
}

export async function fetchPublicRoadData(baseUrl: string): Promise<PublicRoadData> {
  const result = await requestJson<{ laws: Law[]; zones: Array<Record<string, unknown>> }>(baseUrl, '/v1/public');
  const zones = result.zones.map((row): EnforcementZone => ({
    id: String(row.id),
    name: String(row.name),
    center: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    radiusMeters: Number(row.warning_radius_meters),
    vehicle: Array.isArray(row.vehicle_types) ? (row.vehicle_types as Vehicle[]) : [],
    provenance: String(row.provenance),
    sourceUrl: String(row.source_url || ''),
    publicationStatus: 'published',
  }));
  return { laws: result.laws, zones };
}

export async function submitCommunityReport(
  baseUrl: string,
  point: { latitude: number; longitude: number },
  vehicle: Vehicle,
): Promise<Checkpoint> {
  return requestJson<Checkpoint>(baseUrl, '/v1/reports', {
    method: 'POST',
    body: JSON.stringify(point && { ...point, vehicle }),
  });
}

export async function fetchRecentReports(baseUrl: string): Promise<Checkpoint[]> {
  const result = await requestJson<{ reports: Checkpoint[] }>(baseUrl, '/v1/reports');
  return result.reports;
}

export async function checkApi(baseUrl: string): Promise<void> {
  await requestJson<{ status: string }>(baseUrl, '/health');
}
