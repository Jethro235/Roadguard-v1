import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../src/services/preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';

test('loads safe defaults when no saved preferences exist', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
  expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
});

test('loads valid saved vehicle and warning distance but rejects invalid values', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({
    onboardingComplete: true,
    vehicle: 'bus',
    warningDistanceMeters: 1000,
    voiceEnabled: false,
    apiBaseUrl: 'https://api.example.test/',
    locationOptIn: true,
  }));
  expect(await loadPreferences()).toEqual({
    onboardingComplete: true,
    vehicle: 'bus',
    warningDistanceMeters: 1000,
    voiceEnabled: false,
    apiBaseUrl: 'https://api.example.test',
    locationOptIn: true,
  });
});

test('saves preferences to local device storage', async () => {
  await savePreferences({ ...DEFAULT_PREFERENCES, onboardingComplete: true });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    '@roadguard/preferences-v1',
    JSON.stringify({ ...DEFAULT_PREFERENCES, onboardingComplete: true }),
  );
});
