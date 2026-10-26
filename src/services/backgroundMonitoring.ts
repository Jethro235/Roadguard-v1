import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { EnforcementZone } from '../data/zones';
import type { Vehicle } from '../types';

type NativeMonitor = {
  startMonitoring(zonesJson: string, warningDistanceMeters: number): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
  isMonitoring(): Promise<boolean>;
};

const monitor = NativeModules.RoadGuardMonitoring as NativeMonitor | undefined;
const BACKGROUND_LOCATION = 'android.permission.ACCESS_BACKGROUND_LOCATION' as const;
const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS' as const;

export async function startBackgroundMonitoring(
  zones: EnforcementZone[],
  warningDistanceMeters: number,
  vehicle: Vehicle,
): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('Background monitoring is currently available on Android only.');
  if (!monitor) throw new Error('The Android monitoring module is unavailable. Rebuild the app to include it.');

  if (Number(Platform.Version) >= 29) {
    const granted = await PermissionsAndroid.check(BACKGROUND_LOCATION);
    if (!granted) {
      const result = await PermissionsAndroid.request(BACKGROUND_LOCATION, {
        title: 'Allow RoadGuard background location',
        message: 'RoadGuard needs background location only while you explicitly enable background alerts. Location is checked on this device and is not saved as a trip history.',
        buttonPositive: 'Continue',
        buttonNegative: 'Not now',
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Background location was not granted. In Android App info, set Location to “Allow all the time” to enable background alerts.');
      }
    }
  }

  if (Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.check(POST_NOTIFICATIONS);
    if (!granted) {
      const result = await PermissionsAndroid.request(POST_NOTIFICATIONS, {
        title: 'Allow RoadGuard notifications',
        message: 'RoadGuard uses a persistent notification while background location monitoring is active and sends an alert on zone entry.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Notifications were not granted, so background monitoring was not started.');
      }
    }
  }

  const payload = zones.filter((zone) => zone.vehicle.includes(vehicle)).map((zone) => ({
    id: zone.id,
    name: zone.name,
    latitude: zone.center.latitude,
    longitude: zone.center.longitude,
    demo: zone.publicationStatus === 'demo',
  }));
  await monitor.startMonitoring(JSON.stringify(payload), warningDistanceMeters);
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  if (!(await monitor.isMonitoring())) {
    throw new Error('Android did not confirm that background monitoring started. Check location and notification permissions.');
  }
}

export async function stopBackgroundMonitoring(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!monitor) throw new Error('The Android monitoring module is unavailable.');
  await monitor.stopMonitoring();
}

export async function isBackgroundMonitoringActive(): Promise<boolean> {
  if (Platform.OS !== 'android' || !monitor) return false;
  try {
    return await monitor.isMonitoring();
  } catch {
    return false;
  }
}

export function openLocationAppSettings(): Promise<void> {
  return Linking.openSettings();
}
