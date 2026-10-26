import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Vehicle } from '../types';

const STORAGE_KEY = '@roadguard/preferences-v1';
export const WARNING_DISTANCES = [250, 500, 1000] as const;

export type RoadGuardPreferences = {
  onboardingComplete: boolean;
  vehicle: Vehicle;
  warningDistanceMeters: number;
  voiceEnabled: boolean;
  apiBaseUrl: string;
  locationOptIn: boolean;
};

export const DEFAULT_PREFERENCES: RoadGuardPreferences = {
  onboardingComplete: false,
  vehicle: 'car',
  warningDistanceMeters: 500,
  voiceEnabled: true,
  apiBaseUrl: '',
  locationOptIn: false,
};

function isVehicle(value: unknown): value is Vehicle {
  return value === 'car' || value === 'motorcycle' || value === 'bus';
}

export async function loadPreferences(): Promise<RoadGuardPreferences> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCES;

  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return DEFAULT_PREFERENCES;
    const candidate = saved as Partial<RoadGuardPreferences>;
    return {
      onboardingComplete: candidate.onboardingComplete === true,
      vehicle: isVehicle(candidate.vehicle) ? candidate.vehicle : 'car',
      warningDistanceMeters: WARNING_DISTANCES.includes(
        candidate.warningDistanceMeters as (typeof WARNING_DISTANCES)[number],
      )
        ? candidate.warningDistanceMeters!
        : DEFAULT_PREFERENCES.warningDistanceMeters,
      voiceEnabled: candidate.voiceEnabled !== false,
      apiBaseUrl:
        typeof candidate.apiBaseUrl === 'string'
          ? candidate.apiBaseUrl.trim().replace(/\/$/, '')
          : '',
      locationOptIn: candidate.locationOptIn === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(
  preferences: RoadGuardPreferences,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
