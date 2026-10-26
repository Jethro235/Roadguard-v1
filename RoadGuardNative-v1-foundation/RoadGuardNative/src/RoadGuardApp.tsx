import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { LAWS } from './data/laws';
import { ENFORCEMENT_ZONES } from './data/zones';
import { Checkpoint, Coordinates, Vehicle } from './types';
import { distanceInMeters } from './services/geo';
import { loadCheckpoints, saveCheckpoints } from './services/checkpoints';
import { speakEnforcementWarning } from './services/voice';

const DEMO_LOCATION: Coordinates = { latitude: 6.4654, longitude: 3.6016 };

const vehicleLabels: Record<Vehicle, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  bus: 'Bus / Minibus',
};

async function requestLocationPermission() {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return (
    result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED ||
    result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED
  );
}

export default function RoadGuardApp() {
  const [vehicle, setVehicle] = useState<Vehicle>('car');
  const [location, setLocation] = useState<Coordinates>(DEMO_LOCATION);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [screen, setScreen] = useState<'map' | 'laws' | 'rights'>('map');
  const [locationReady, setLocationReady] = useState(false);
  const warnedZoneIds = useRef(new Set<string>());

  const activeZone = useMemo(() => {
    return ENFORCEMENT_ZONES.find(
      (zone) =>
        zone.vehicle.includes(vehicle) &&
        distanceInMeters(location, zone.center) <= zone.radiusMeters,
    );
  }, [location, vehicle]);

  useEffect(() => {
    loadCheckpoints().then(setCheckpoints).catch(() => undefined);
  }, []);

  useEffect(() => {
    let watchId: number | null = null;

    async function startLocation() {
      const allowed = await requestLocationPermission();

      if (!allowed) {
        Alert.alert(
          'Location needed',
          'RoadGuard needs location access to provide preventive road warnings.',
        );
        return;
      }

      setLocationReady(true);

      watchId = Geolocation.watchPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          setLocationReady(false);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 20,
          interval: 5000,
          fastestInterval: 3000,
        },
      );
    }

    startLocation();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeZone) return;

    if (!warnedZoneIds.current.has(activeZone.id)) {
      warnedZoneIds.current.add(activeZone.id);
      speakEnforcementWarning(activeZone.speedLimitKmh);
    }
  }, [activeZone]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCheckpoints((items) => {
        const fresh = items.filter(
          (item) => new Date(item.expiresAt).getTime() > Date.now(),
        );
        saveCheckpoints(fresh).catch(() => undefined);
        return fresh;
      });
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  function reportCheckpoint() {
    const now = new Date();
    const checkpoint: Checkpoint = {
      id: `${Date.now()}-${Math.random()}`,
      latitude: location.latitude,
      longitude: location.longitude,
      reportedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      confirmations: 1,
      vehicle: [vehicle],
    };

    const next = [checkpoint, ...checkpoints];
    setCheckpoints(next);
    saveCheckpoints(next).catch(() => undefined);

    Alert.alert(
      'Checkpoint reported',
      'Your community report is active for 2 hours.',
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>RoadGuard</Text>
          <Text style={styles.subtitle}>Prevent problems before they happen.</Text>
        </View>
        <View style={styles.gpsBadge}>
          <View style={styles.dot} />
          <Text style={styles.gpsText}>{locationReady ? 'GPS' : 'Demo GPS'}</Text>
        </View>
      </View>

      {screen === 'map' && (
        <>
          <View style={styles.vehicleRow}>
            {(Object.keys(vehicleLabels) as Vehicle[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setVehicle(item);
                  warnedZoneIds.current.clear();
                }}
                style={[
                  styles.vehicleButton,
                  vehicle === item && styles.vehicleButtonActive,
                ]}>
                <Text
                  style={[
                    styles.vehicleText,
                    vehicle === item && styles.vehicleTextActive,
                  ]}>
                  {item === 'car' ? '🚗' : item === 'motorcycle' ? '🏍️' : '🚐'}{' '}
                  {vehicleLabels[item]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.mapWrap}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              showsUserLocation
              showsMyLocationButton
              initialRegion={{
                ...location,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}>
              {ENFORCEMENT_ZONES.map((zone) => (
                <React.Fragment key={zone.id}>
                  <Circle
                    center={zone.center}
                    radius={zone.radiusMeters}
                    strokeWidth={2}
                    strokeColor="#e8a63d"
                    fillColor="rgba(232,166,61,0.12)"
                  />
                  <Marker coordinate={zone.center} title={zone.name} />
                </React.Fragment>
              ))}

              {checkpoints
                .filter((item) => item.vehicle.includes(vehicle))
                .map((item) => (
                  <Marker
                    key={item.id}
                    coordinate={{
                      latitude: item.latitude,
                      longitude: item.longitude,
                    }}
                    pinColor="#d84b55"
                    title="Community checkpoint"
                    description="Temporary report — expires after 2 hours"
                  />
                ))}
            </MapView>
          </View>

          <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            {activeZone ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>⚠️ Enforcement zone</Text>
                <Text style={styles.warningText}>
                  You are inside the {activeZone.radiusMeters}m warning area.
                  Speed limit reference: {activeZone.speedLimitKmh} km/h.
                </Text>
                <Pressable
                  style={styles.voiceButton}
                  onPress={() => speakEnforcementWarning(activeZone.speedLimitKmh)}>
                  <Text style={styles.voiceText}>🔊 Repeat warning</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.safeCard}>
                <Text style={styles.safeTitle}>🟢 No active zone warning</Text>
                <Text style={styles.muted}>
                  RoadGuard will warn you when you enter a configured zone.
                </Text>
              </View>
            )}

            <Pressable style={styles.reportButton} onPress={reportCheckpoint}>
              <Text style={styles.reportText}>🚨 Report Checkpoint</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Recent community reports</Text>
            {checkpoints.filter((item) => item.vehicle.includes(vehicle)).map((item) => (
              <View key={item.id} style={styles.reportCard}>
                <Text style={styles.reportCardTitle}>Checkpoint reported nearby</Text>
                <Text style={styles.muted}>
                  {item.confirmations} confirmation • expires{' '}
                  {new Date(item.expiresAt).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {screen === 'laws' && (
        <ScrollView style={styles.page}>
          <Text style={styles.kicker}>KNOW YOUR RIGHTS & FINES</Text>
          <Text style={styles.pageTitle}>Road rules for {vehicleLabels[vehicle].toLowerCase()}</Text>
          {LAWS.filter((law) => law.vehicle.includes(vehicle)).map((law) => (
            <View key={law.id} style={styles.lawCard}>
              <Text style={styles.lawTitle}>{law.title}</Text>
              <Text style={styles.muted}>{law.summary}</Text>
              <Text style={styles.fine}>{law.fine}</Text>
              {law.action && <Text style={styles.muted}>{law.action}</Text>}
              <Text style={styles.source}>{law.source}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {screen === 'rights' && (
        <ScrollView style={styles.page}>
          <Text style={styles.kicker}>MOTORIST RIGHTS</Text>
          <Text style={styles.pageTitle}>Know the rule before the stop.</Text>
          <View style={styles.lawCard}>
            <Text style={styles.lawTitle}>Officer identification</Text>
            <Text style={styles.muted}>
              Officials should display a visible ID or name tag.
            </Text>
          </View>
          <View style={styles.lawCard}>
            <Text style={styles.lawTitle}>Use official information</Text>
            <Text style={styles.muted}>
              RoadGuard provides reference information and should not be treated as a substitute for legal advice.
            </Text>
          </View>
          <View style={styles.lawCard}>
            <Text style={styles.lawTitle}>Preventive first</Text>
            <Text style={styles.muted}>
              Slow down, follow posted signs, and use the app to understand the applicable rule before reaching an enforcement area.
            </Text>
          </View>
        </ScrollView>
      )}

      <View style={styles.bottomNav}>
        <Pressable onPress={() => setScreen('map')} style={styles.navButton}>
          <Text style={screen === 'map' ? styles.navActive : styles.navText}>🗺️ Map</Text>
        </Pressable>
        <Pressable onPress={() => setScreen('laws')} style={styles.navButton}>
          <Text style={screen === 'laws' ? styles.navActive : styles.navText}>📚 Laws</Text>
        </Pressable>
        <Pressable onPress={() => setScreen('rights')} style={styles.navButton}>
          <Text style={screen === 'rights' ? styles.navActive : styles.navText}>🛡️ Rights</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071019' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { color: '#f4f8fb', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8295a8', fontSize: 12, marginTop: 2 },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#102019',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: '#48dd91', marginRight: 6 },
  gpsText: { color: '#8ce3b7', fontSize: 11, fontWeight: '700' },
  vehicleRow: { paddingHorizontal: 12, flexDirection: 'row', gap: 7, paddingBottom: 10 },
  vehicleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1b2a38',
    backgroundColor: '#0d1823',
    alignItems: 'center',
  },
  vehicleButtonActive: { borderColor: '#54d7a1', backgroundColor: '#10241d' },
  vehicleText: { color: '#8ea0b2', fontSize: 11, fontWeight: '700' },
  vehicleTextActive: { color: '#eafff5' },
  mapWrap: { height: 360, marginHorizontal: 10, borderRadius: 18, overflow: 'hidden' },
  panel: { flex: 1 },
  panelContent: { padding: 12, paddingBottom: 100 },
  warningCard: {
    backgroundColor: '#33230f',
    borderColor: '#6d4b1b',
    borderWidth: 1,
    padding: 15,
    borderRadius: 15,
  },
  warningTitle: { color: '#ffd78b', fontSize: 16, fontWeight: '800' },
  warningText: { color: '#d6c19b', lineHeight: 20, marginTop: 6 },
  voiceButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#e6f8ef',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
  },
  voiceText: { color: '#08120e', fontWeight: '800' },
  safeCard: {
    backgroundColor: '#0d1e18',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#173a2c',
  },
  safeTitle: { color: '#7be0b2', fontWeight: '800', fontSize: 15 },
  muted: { color: '#8da0b2', lineHeight: 19, marginTop: 4 },
  reportButton: {
    marginTop: 10,
    backgroundColor: '#e65c68',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  reportText: { color: '#fff', fontWeight: '900' },
  sectionTitle: { color: '#f3f7fa', fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 9 },
  reportCard: { backgroundColor: '#0d1823', padding: 13, borderRadius: 12, marginBottom: 8 },
  reportCardTitle: { color: '#eaf0f4', fontWeight: '700' },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#08131d',
    borderTopWidth: 1,
    borderTopColor: '#1a2937',
    paddingBottom: 8,
    paddingTop: 8,
  },
  navButton: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navText: { color: '#72869a', fontSize: 12, fontWeight: '700' },
  navActive: { color: '#6fe0b1', fontSize: 12, fontWeight: '800' },
  page: { flex: 1, padding: 16 },
  kicker: { color: '#6fe0b1', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  pageTitle: { color: '#f4f8fb', fontSize: 27, fontWeight: '800', marginTop: 7, marginBottom: 16 },
  lawCard: { backgroundColor: '#0d1823', padding: 15, borderRadius: 14, marginBottom: 10 },
  lawTitle: { color: '#eef5f8', fontSize: 15, fontWeight: '800' },
  fine: { color: '#70dfb1', fontSize: 16, fontWeight: '900', marginTop: 9 },
  source: { color: '#617588', fontSize: 10, marginTop: 10 },
});
