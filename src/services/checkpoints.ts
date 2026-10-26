import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Checkpoint } from '../types';

const STORAGE_KEY = '@roadguard/checkpoints';

export async function loadCheckpoints(): Promise<Checkpoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  const items = JSON.parse(raw) as Checkpoint[];
  return removeExpired(items);
}

export async function saveCheckpoints(items: Checkpoint[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(removeExpired(items)));
}

export function removeExpired(items: Checkpoint[]): Checkpoint[] {
  const now = Date.now();
  return items.filter((item) => {
    const expiresAt = new Date(item.expiresAt).getTime();
    return (
      Number.isFinite(item.latitude) &&
      item.latitude >= -90 &&
      item.latitude <= 90 &&
      Number.isFinite(item.longitude) &&
      item.longitude >= -180 &&
      item.longitude <= 180 &&
      Number.isFinite(expiresAt) &&
      expiresAt > now &&
      Array.isArray(item.vehicle) &&
      item.vehicle.length > 0
    );
  });
}
