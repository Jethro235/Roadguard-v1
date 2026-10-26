import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { OnboardingScreen } from './components/OnboardingScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { LAWS } from './data/laws';
import { ENFORCEMENT_ZONES } from './data/zones';
import type { Checkpoint, Coordinates, Law, Vehicle } from './types';
import { newlyEnteredZones, zonesContainingPoint } from './services/geo';
import { loadCheckpoints, saveCheckpoints } from './services/checkpoints';
import { checkApi, fetchPublicRoadData, fetchRecentReports, normalizeApiBaseUrl, submitCommunityReport } from './services/api';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type RoadGuardPreferences } from './services/preferences';
import { speakZoneWarning } from './services/voice';
import { isBackgroundMonitoringActive, openLocationAppSettings, startBackgroundMonitoring, stopBackgroundMonitoring } from './services/backgroundMonitoring';

const DEMO_LOCATION: Coordinates = { latitude: 6.4654, longitude: 3.6016 };
const VEHICLE_LABELS: Record<Vehicle, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  bus: 'Bus / Minibus',
};

type Screen = 'map' | 'laws' | 'rights' | 'settings';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) return true;
  const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
  return result[fine] === PermissionsAndroid.RESULTS.GRANTED || result[coarse] === PermissionsAndroid.RESULTS.GRANTED;
}

function renderMapError(error: Error, retry: () => void) {
  return (
    <View style={styles.mapNotice}>
      <Text style={styles.cardTitle}>Map unavailable</Text>
      <Text style={styles.muted}>{error.message || 'The map could not be initialized.'}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.smallButton}>
        <Text style={styles.smallButtonText}>Retry map</Text>
      </Pressable>
    </View>
  );
}

export default function RoadGuardApp() {
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<RoadGuardPreferences>(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('map');
  const [location, setLocation] = useState<Coordinates>(DEMO_LOCATION);
  const [locationReady, setLocationReady] = useState(false);
  const [locationMessage, setLocationMessage] = useState('Location is off. Demo mode is available.');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [laws, setLaws] = useState<Law[]>(LAWS);
  const [zones, setZones] = useState(ENFORCEMENT_ZONES);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState('Demo/offline mode. No API is configured.');
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapTimedOut, setMapTimedOut] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [checkpointMessage, setCheckpointMessage] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [backgroundMonitoring, setBackgroundMonitoring] = useState(false);
  const [backgroundMessage, setBackgroundMessage] = useState('Background monitoring is off.');
  const previousZoneIds = useRef<Set<string>>(new Set());
  const mapRef = useRef<MapView | null>(null);

  const insideZones = useMemo(
    () => locationReady
      ? zonesContainingPoint(location, zones, preferences.vehicle, preferences.warningDistanceMeters)
      : [],
    [location, locationReady, preferences.vehicle, preferences.warningDistanceMeters, zones],
  );
  const activeZone = insideZones[0];
  const visibleCheckpoints = checkpoints.filter((item) => item.vehicle.includes(preferences.vehicle));

  function updatePreferences(next: RoadGuardPreferences) {
    setPreferences(next);
    savePreferences(next).catch((error: unknown) => {
      console.error('[RoadGuard] Could not save preferences:', error);
      setStorageMessage(`Settings could not be saved: ${errorMessage(error)}`);
    });
    if (backgroundMonitoring && (next.warningDistanceMeters !== preferences.warningDistanceMeters || next.vehicle !== preferences.vehicle)) {
      startBackgroundMonitoring(zones, next.warningDistanceMeters, next.vehicle).catch((error: unknown) => {
        setBackgroundMonitoring(false);
        setBackgroundMessage(`Monitoring stopped after settings changed: ${errorMessage(error)}`);
      });
    }
  }

  useEffect(() => {
    if (!preferencesReady) return;
    isBackgroundMonitoringActive().then((active) => {
      setBackgroundMonitoring(active);
      setBackgroundMessage(active ? 'Monitoring is active with a persistent Android notification.' : 'Background monitoring is off.');
    });
  }, [preferencesReady]);

  useEffect(() => {
    let mounted = true;
    loadPreferences()
      .then((value) => {
        if (mounted) setPreferences(value);
      })
      .catch((error: unknown) => {
        console.error('[RoadGuard] Could not load settings:', error);
        if (mounted) setStorageMessage('Saved settings could not be loaded. Default settings are active.');
      })
      .finally(() => {
        if (mounted) setPreferencesReady(true);
      });
    loadCheckpoints()
      .then((items) => { if (mounted) setCheckpoints(items); })
      .catch((error: unknown) => {
        console.error('[RoadGuard] Could not load reports:', error);
        if (mounted) setStorageMessage(`Saved reports could not be loaded: ${errorMessage(error)}`);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!preferencesReady || !preferences.onboardingComplete || !preferences.locationOptIn) return undefined;
    let mounted = true;
    let watchId: number | null = null;
    setLocationMessage('Waiting for a GPS fix. Demo coordinates are not used for live warnings.');
    requestLocationPermission()
      .then((allowed) => {
        if (!mounted) return;
        if (!allowed) {
          setLocationReady(false);
          setLocationMessage('Location permission is off. Demo mode remains available; live warnings and reports are paused.');
          return;
        }
        const id = Geolocation.watchPosition(
          (position) => {
            if (!mounted) return;
            setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            mapRef.current?.animateToRegion({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              latitudeDelta: 0.035,
              longitudeDelta: 0.035,
            }, 500);
            setLocationReady(true);
            setLocationMessage('');
          },
          (error) => {
            console.error('[RoadGuard] GPS update failed:', error);
            if (mounted) {
              setLocationReady(false);
              setLocationMessage(`GPS is unavailable: ${error.message}. Demo mode remains available.`);
            }
          },
          { enableHighAccuracy: true, distanceFilter: 15, interval: 5000, fastestInterval: 3000 },
        );
        if (mounted) watchId = id;
        else Geolocation.clearWatch(id);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLocationReady(false);
          setLocationMessage(`Location could not be started: ${errorMessage(error)}. Demo mode remains available.`);
        }
      });
    return () => {
      mounted = false;
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [preferences.locationOptIn, preferences.onboardingComplete, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady || !preferences.apiBaseUrl) return undefined;
    let mounted = true;
    async function syncPublicData() {
      try {
        await checkApi(preferences.apiBaseUrl);
        const [publicData, remoteReports] = await Promise.all([
          fetchPublicRoadData(preferences.apiBaseUrl),
          fetchRecentReports(preferences.apiBaseUrl),
        ]);
        if (!mounted) return;
        setLaws(publicData.laws);
        setZones(publicData.zones);
        setCheckpoints((current) => {
          const localIds = new Set(current.map((item) => item.id));
          return [...remoteReports.filter((item) => !localIds.has(item.id)), ...current];
        });
        setApiMessage(`Connected. ${publicData.laws.length} reviewed law records and ${publicData.zones.length} published zones loaded.`);
      } catch (error) {
        if (mounted) setApiMessage(`Offline: ${errorMessage(error)}. Local demo data remain available.`);
      }
    }
    syncPublicData();
    return () => { mounted = false; };
  }, [preferences.apiBaseUrl, preferencesReady]);

  useEffect(() => {
    const previous = previousZoneIds.current;
    const entered = newlyEnteredZones(previous, insideZones);
    const current = new Set(insideZones.map((zone) => zone.id));
    previousZoneIds.current = current;
    if (!preferences.voiceEnabled || entered.length === 0) return;
    const zone = entered[0];
    speakZoneWarning(zone.name, zone.publicationStatus === 'demo')
      .then(() => setVoiceMessage(null))
      .catch((error: unknown) => {
        console.error('[RoadGuard] Voice warning failed:', error);
        setVoiceMessage(`Voice alert unavailable: ${errorMessage(error)}`);
      });
  }, [insideZones, preferences.voiceEnabled]);

  useEffect(() => {
    const timer = setTimeout(() => { if (!mapLoaded) setMapTimedOut(true); }, 10000);
    return () => clearTimeout(timer);
  }, [mapAttempt, mapLoaded]);

  useEffect(() => {
    const timer = setInterval(() => {
      const fresh = checkpoints.filter((item) => new Date(item.expiresAt).getTime() > Date.now());
      if (fresh.length === checkpoints.length) return;
      setCheckpoints(fresh);
      saveCheckpoints(fresh).catch((error: unknown) => {
        console.error('[RoadGuard] Could not expire saved reports:', error);
        setStorageMessage(`Report storage failed: ${errorMessage(error)}`);
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [checkpoints]);

  async function enableLocation() {
    try {
      const allowed = await requestLocationPermission();
      if (!allowed) {
        setLocationReady(false);
        setLocationMessage('Location permission was denied. Demo mode remains available.');
        return;
      }
      setLocationMessage('Starting foreground GPS. Background alerts are not enabled.');
      updatePreferences({ ...preferences, locationOptIn: true });
    } catch (error) {
      setLocationMessage(`Location permission could not be checked: ${errorMessage(error)}`);
    }
  }

  async function toggleBackgroundMonitoring(enabled: boolean) {
    if (!enabled) {
      try {
        await stopBackgroundMonitoring();
        setBackgroundMonitoring(false);
        setBackgroundMessage('Background monitoring is off.');
      } catch (error) {
        setBackgroundMessage(`Could not stop monitoring: ${errorMessage(error)}`);
      }
      return;
    }
    if (!locationReady) {
      setBackgroundMessage('Enable GPS and wait for a fix before starting background monitoring.');
      return;
    }
    try {
      await startBackgroundMonitoring(zones, preferences.warningDistanceMeters, preferences.vehicle);
      setBackgroundMonitoring(true);
      setBackgroundMessage('Monitoring is active with a persistent Android notification. Background behavior still needs real-device verification.');
    } catch (error) {
      setBackgroundMonitoring(false);
      setBackgroundMessage(errorMessage(error));
    }
  }

  async function reportCheckpoint() {
    if (!locationReady || reporting) return;
    setReporting(true);
    const now = new Date();
    const checkpoint: Checkpoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      latitude: location.latitude,
      longitude: location.longitude,
      reportedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      confirmations: 1,
      vehicle: [preferences.vehicle],
    };
    const localNext = [checkpoint, ...checkpoints];
    setCheckpoints(localNext);
    setCheckpointMessage('Report saved on this device. It expires in two hours.');
    try {
      await saveCheckpoints(localNext);
      setStorageMessage(null);
    } catch (error) {
      setStorageMessage(`Report is visible for this session but could not be saved: ${errorMessage(error)}`);
    }
    if (preferences.apiBaseUrl) {
      try {
        const published = await submitCommunityReport(preferences.apiBaseUrl, location, preferences.vehicle);
        const saved = [published, ...localNext.filter((item) => item.id !== checkpoint.id)];
        setCheckpoints(saved);
        setCheckpointMessage('Community report submitted. It is temporary and expires in two hours.');
        try {
          await saveCheckpoints(saved);
        } catch (error) {
          setStorageMessage(`Community report was submitted but this device could not update its local copy: ${errorMessage(error)}`);
        }
      } catch (error) {
        setCheckpointMessage(`Saved locally; the community service is unavailable (${errorMessage(error)}).`);
        setApiMessage(`Offline: ${errorMessage(error)}. This report remains on this device.`);
      }
    }
    setReporting(false);
  }

  async function repeatWarning() {
    if (!activeZone || !preferences.voiceEnabled) return;
    try {
      await speakZoneWarning(activeZone.name, activeZone.publicationStatus === 'demo');
      setVoiceMessage(null);
    } catch (error) {
      setVoiceMessage(`Voice alert unavailable: ${errorMessage(error)}`);
    }
  }

  async function saveApiUrl(value: string) {
    try {
      const baseUrl = normalizeApiBaseUrl(value);
      const next = { ...preferences, apiBaseUrl: baseUrl };
      updatePreferences(next);
      if (!baseUrl) {
        setApiMessage('Demo/offline mode. No API is configured.');
        setLaws(LAWS);
        setZones(ENFORCEMENT_ZONES);
        return;
      }
      await checkApi(baseUrl);
      const publicData = await fetchPublicRoadData(baseUrl);
      const remoteReports = await fetchRecentReports(baseUrl);
      setLaws(publicData.laws);
      setZones(publicData.zones);
      setCheckpoints((current) => {
        const localIds = new Set(current.map((item) => item.id));
        return [...remoteReports.filter((item) => !localIds.has(item.id)), ...current];
      });
      setApiMessage(`Connected. ${publicData.laws.length} reviewed law records and ${publicData.zones.length} published zones loaded.`);
    } catch (error) {
      setApiMessage(`API unavailable; local demo data remain active. ${errorMessage(error)}`);
    }
  }

  function retryMap() {
    setMapLoaded(false);
    setMapTimedOut(false);
    setMapErrorMessage(null);
    setMapAttempt((attempt) => attempt + 1);
  }

  async function finishOnboarding() {
    updatePreferences({ ...preferences, onboardingComplete: true });
    setScreen('map');
  }

  if (!preferencesReady) {
    return (
      <View style={[styles.root, styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#54d7a1" size="large" />
        <Text style={styles.muted}>Loading RoadGuard…</Text>
      </View>
    );
  }

  if (!preferences.onboardingComplete) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <OnboardingScreen
          vehicle={preferences.vehicle}
          onVehicleChange={(vehicle) => updatePreferences({ ...preferences, vehicle })}
          onContinue={finishOnboarding}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>RoadGuard</Text>
          <Text style={styles.subtitle}>Prevent problems before they happen.</Text>
        </View>
        <View style={[styles.gpsBadge, locationReady && styles.gpsBadgeReady]}>
          <View style={[styles.dot, locationReady && styles.dotReady]} />
          <Text style={styles.gpsText}>{locationReady ? 'GPS ready' : 'Demo mode'}</Text>
        </View>
      </View>

      {storageMessage ? <Text accessibilityLiveRegion="polite" style={styles.errorBanner}>{storageMessage}</Text> : null}
      {voiceMessage ? <Text accessibilityLiveRegion="polite" style={styles.errorBanner}>{voiceMessage}</Text> : null}
      {screen === 'map' ? (
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          {!locationReady ? (
            <View style={styles.infoBanner}>
              <Text style={styles.bannerTitle}>Demo/offline mode</Text>
              <Text style={styles.muted}>{locationMessage}</Text>
              <Pressable accessibilityRole="button" onPress={enableLocation} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Enable GPS</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.vehicleRow}>
            {(Object.keys(VEHICLE_LABELS) as Vehicle[]).map((vehicle) => (
              <Pressable
                key={vehicle}
                accessibilityRole="radio"
                accessibilityState={{ checked: preferences.vehicle === vehicle }}
                onPress={() => {
                  previousZoneIds.current.clear();
                  updatePreferences({ ...preferences, vehicle });
                }}
                style={[styles.vehicleButton, preferences.vehicle === vehicle && styles.vehicleButtonActive]}>
                <Text style={[styles.vehicleText, preferences.vehicle === vehicle && styles.vehicleTextActive]}>{VEHICLE_LABELS[vehicle]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.mapWrap}>
            <AppErrorBoundary
              key={mapAttempt}
              onError={(error) => { setMapLoaded(false); setMapTimedOut(true); setMapErrorMessage(error.message); }}
              fallback={renderMapError}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                showsUserLocation={locationReady}
                showsMyLocationButton={locationReady}
                onMapLoaded={() => { setMapLoaded(true); setMapTimedOut(false); }}
                initialRegion={{ ...location, latitudeDelta: 0.035, longitudeDelta: 0.035 }}>
                {zones.map((zone) => (
                  <React.Fragment key={zone.id}>
                    <Circle
                      center={zone.center}
                      radius={preferences.warningDistanceMeters}
                      strokeWidth={2}
                      strokeColor={zone.publicationStatus === 'demo' ? '#e8a63d' : '#54d7a1'}
                      fillColor={zone.publicationStatus === 'demo' ? 'rgba(232,166,61,0.12)' : 'rgba(84,215,161,0.12)'}
                    />
                    <Marker coordinate={zone.center} title={zone.publicationStatus === 'demo' ? 'Demo only — not official' : zone.name} description={`${zone.provenance}${zone.sourceUrl ? ` · ${zone.sourceUrl}` : ''}`} />
                  </React.Fragment>
                ))}
                {visibleCheckpoints.map((item) => (
                  <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} pinColor="#d84b55" title="Community checkpoint report" description="User report; not official. Expires after two hours." />
                ))}
              </MapView>
            </AppErrorBoundary>
            {!mapLoaded ? (
              <View style={styles.mapOverlay}>
                <Text style={styles.cardTitle}>{mapTimedOut ? 'Map tiles unavailable' : 'Loading map'}</Text>
                <Text style={styles.muted}>
                  {mapTimedOut
                    ? `${mapErrorMessage ? `${mapErrorMessage} ` : ''}Google Maps may need a user-configured API key. The other RoadGuard screens work without map tiles.`
                    : 'Initializing the map. Demo zones are illustrative only.'}
                </Text>
                {mapTimedOut ? <Pressable accessibilityRole="button" onPress={retryMap} style={styles.smallButton}><Text style={styles.smallButtonText}>Retry map</Text></Pressable> : null}
              </View>
            ) : null}
          </View>
          <View style={styles.provenanceBanner}>
            <Text style={styles.provenanceTitle}>Demo zones are not official</Text>
            <Text style={styles.muted}>Only published zones from a configured service can be treated as reviewed data. Current warning distance: {preferences.warningDistanceMeters} m.</Text>
          </View>
          {activeZone ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Proximity alert</Text>
              <Text style={styles.warningText}>
                {activeZone.publicationStatus === 'demo' ? 'Demo alert only: ' : ''}{activeZone.name}. This alert is based on your device GPS while the app is open.
              </Text>
              {preferences.voiceEnabled ? (
                <Pressable accessibilityRole="button" onPress={() => repeatWarning()} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Repeat voice alert</Text>
                </Pressable>
              ) : <Text style={styles.muted}>Voice alerts are off. Change them in Settings.</Text>}
            </View>
          ) : (
            <View style={styles.safeCard}>
              <Text style={styles.safeTitle}>{locationReady ? 'No nearby configured zone' : 'Live alerts are paused'}</Text>
              <Text style={styles.muted}>{locationReady ? 'RoadGuard checks location on this device while open.' : 'Turn on GPS when you want live proximity alerts. Demo coordinates are never used for live alerts.'}</Text>
            </View>
          )}
          <Pressable accessibilityRole="button" disabled={!locationReady || reporting} onPress={reportCheckpoint} style={[styles.reportButton, (!locationReady || reporting) && styles.disabledButton]}>
            <Text style={styles.reportText}>{reporting ? 'Submitting report…' : locationReady ? 'Report a checkpoint here' : 'GPS needed to report'}</Text>
          </Pressable>
          <Text style={styles.privacyNote}>Your location is sent only when you tap the report button and have configured an API. Otherwise the report stays on this device.</Text>
          {checkpointMessage ? <Text accessibilityLiveRegion="polite" style={styles.successBanner}>{checkpointMessage}</Text> : null}
          <Text style={styles.sectionTitle}>Recent community reports</Text>
          {visibleCheckpoints.length ? visibleCheckpoints.map((item) => (
            <View key={item.id} style={styles.reportCard}>
              <Text style={styles.reportCardTitle}>Community report · not official</Text>
              <Text style={styles.muted}>{item.confirmations} report · expires {new Date(item.expiresAt).toLocaleTimeString()}</Text>
            </View>
          )) : <Text style={styles.muted}>No recent reports for this vehicle. Reports are temporary and expire after two hours.</Text>}
        </ScrollView>
      ) : null}

      {screen === 'laws' ? (
        <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
          <Text style={styles.kicker}>ROAD RULE REFERENCES</Text>
          <Text style={styles.pageTitle}>For {VEHICLE_LABELS[preferences.vehicle].toLowerCase()}</Text>
          <View style={styles.provenanceBanner}>
            <Text style={styles.provenanceTitle}>Reference information, not legal advice</Text>
            <Text style={styles.muted}>Demo entries are unverified. No fine amounts are shown until authoritative sources are reviewed and published.</Text>
          </View>
          {laws.filter((law) => law.vehicle.includes(preferences.vehicle)).map((law) => (
            <View key={law.id} style={styles.lawCard}>
              <Text style={styles.lawTitle}>{law.title}</Text>
              <Text style={styles.muted}>{law.summary}</Text>
              <Text style={styles.fine}>{law.fine || 'Fine not listed'}</Text>
              <Text style={styles.source}>{law.reviewStatus === 'published' ? 'Reviewed and published' : 'Demo · unverified'} · {law.source}{law.effectiveDate ? ` · Effective ${law.effectiveDate}` : ''}</Text>
            </View>
          ))}
          {laws.length === 0 ? <Text style={styles.muted}>No reviewed law references are available. Check back when a trusted source has been reviewed.</Text> : null}
          <Text style={styles.offlineText}>Data source status: {apiMessage}</Text>
        </ScrollView>
      ) : null}

      {screen === 'rights' ? (
        <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
          <Text style={styles.kicker}>GENERAL SAFETY GUIDANCE</Text>
          <Text style={styles.pageTitle}>Know the rule before the stop.</Text>
          <View style={styles.provenanceBanner}><Text style={styles.provenanceTitle}>Not legal advice</Text><Text style={styles.muted}>This screen contains general reminders only. It does not state specific legal powers or guarantee an outcome. Consult current official sources or a qualified lawyer for legal advice.</Text></View>
          <View style={styles.lawCard}><Text style={styles.lawTitle}>Stay calm and safe</Text><Text style={styles.muted}>Prioritize safety, follow lawful road instructions, and avoid confrontation.</Text></View>
          <View style={styles.lawCard}><Text style={styles.lawTitle}>Ask for clear information</Text><Text style={styles.muted}>If you need clarification, ask respectfully what rule or document is relevant and where you can verify it.</Text></View>
          <View style={styles.lawCard}><Text style={styles.lawTitle}>Keep records safely</Text><Text style={styles.muted}>Use lawful, safe means to keep receipts or other documents. Do not use RoadGuard as a substitute for emergency or legal services.</Text></View>
        </ScrollView>
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          preferences={preferences}
          locationReady={locationReady}
          locationMessage={locationMessage}
          apiMessage={apiMessage}
          onChange={updatePreferences}
          onEnableLocation={enableLocation}
          backgroundMonitoring={backgroundMonitoring}
          backgroundMessage={backgroundMessage}
          onToggleBackground={toggleBackgroundMonitoring}
          onOpenSettings={() => openLocationAppSettings().catch(() => undefined)}
          onSaveApi={saveApiUrl}
          onDone={() => setScreen('map')}
        />
      ) : null}

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {([
          ['map', 'Map'], ['laws', 'Laws'], ['rights', 'Rights'], ['settings', 'Settings'],
        ] as Array<[Screen, string]>).map(([target, label]) => (
          <Pressable key={target} accessibilityRole="button" accessibilityState={{ selected: screen === target }} onPress={() => setScreen(target)} style={styles.navButton}>
            <Text style={screen === target ? styles.navActive : styles.navText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071019' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandCopy: { flex: 1, paddingRight: 12 },
  brand: { color: '#f4f8fb', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8295a8', fontSize: 12, marginTop: 2 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#33230f', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  gpsBadgeReady: { backgroundColor: '#102019' },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: '#e6a843', marginRight: 6 },
  dotReady: { backgroundColor: '#48dd91' },
  gpsText: { color: '#f1c982', fontSize: 11, fontWeight: '700' },
  main: { flex: 1 },
  mainContent: { paddingHorizontal: 12, paddingBottom: 112 },
  vehicleRow: { flexDirection: 'row', gap: 7, paddingBottom: 10 },
  vehicleButton: { flex: 1, minHeight: 48, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#1b2a38', backgroundColor: '#0d1823', alignItems: 'center', justifyContent: 'center' },
  vehicleButtonActive: { borderColor: '#54d7a1', backgroundColor: '#10241d' },
  vehicleText: { color: '#8ea0b2', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  vehicleTextActive: { color: '#eafff5' },
  infoBanner: { backgroundColor: '#33230f', marginBottom: 10, padding: 12, borderRadius: 12 },
  bannerTitle: { color: '#ffd78b', fontWeight: '800' },
  errorBanner: { color: '#ffb5b5', backgroundColor: '#35191e', marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, fontSize: 12, lineHeight: 17 },
  successBanner: { color: '#8ce3b7', fontSize: 12, marginTop: 8 },
  mapWrap: { height: 270, borderRadius: 18, overflow: 'hidden', backgroundColor: '#10202d' },
  mapOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#10202d' },
  mapNotice: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#10202d' },
  smallButton: { minHeight: 42, marginTop: 10, paddingHorizontal: 16, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#173a2c', borderRadius: 10 },
  smallButtonText: { color: '#8ce3b7', fontWeight: '800' },
  provenanceBanner: { backgroundColor: '#17212a', borderWidth: 1, borderColor: '#314152', padding: 13, borderRadius: 13, marginTop: 10 },
  provenanceTitle: { color: '#f1c982', fontWeight: '800' },
  cardTitle: { color: '#f4f8fb', fontSize: 16, fontWeight: '800' },
  warningCard: { backgroundColor: '#33230f', borderColor: '#6d4b1b', borderWidth: 1, padding: 15, borderRadius: 15, marginTop: 10 },
  warningTitle: { color: '#ffd78b', fontSize: 16, fontWeight: '800' },
  warningText: { color: '#d6c19b', lineHeight: 20, marginTop: 6 },
  safeCard: { backgroundColor: '#0d1e18', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#173a2c', marginTop: 10 },
  safeTitle: { color: '#7be0b2', fontWeight: '800', fontSize: 15 },
  muted: { color: '#8da0b2', lineHeight: 19, marginTop: 4 },
  reportButton: { minHeight: 50, marginTop: 10, backgroundColor: '#d84b55', paddingVertical: 14, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: '#57363a' },
  reportText: { color: '#fff', fontWeight: '900' },
  privacyNote: { color: '#8094a7', fontSize: 11, lineHeight: 16, marginTop: 7 },
  sectionTitle: { color: '#f3f7fa', fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 9 },
  reportCard: { backgroundColor: '#0d1823', padding: 13, borderRadius: 12, marginBottom: 8 },
  reportCardTitle: { color: '#eaf0f4', fontWeight: '700' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#08131d', borderTopWidth: 1, borderTopColor: '#1a2937', paddingTop: 8 },
  navButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  navText: { color: '#72869a', fontSize: 11, fontWeight: '700' },
  navActive: { color: '#6fe0b1', fontSize: 11, fontWeight: '800' },
  page: { flex: 1 },
  pageContent: { padding: 16, paddingBottom: 112 },
  kicker: { color: '#6fe0b1', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  pageTitle: { color: '#f4f8fb', fontSize: 27, fontWeight: '800', marginTop: 7, marginBottom: 16 },
  lawCard: { backgroundColor: '#0d1823', padding: 15, borderRadius: 14, marginTop: 10 },
  lawTitle: { color: '#eef5f8', fontSize: 15, fontWeight: '800' },
  fine: { color: '#70dfb1', fontSize: 14, fontWeight: '900', marginTop: 9 },
  source: { color: '#f1c982', fontSize: 11, lineHeight: 16, marginTop: 10 },
  offlineText: { color: '#8295a8', fontSize: 11, lineHeight: 16, marginTop: 14 },
});
