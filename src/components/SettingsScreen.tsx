import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { WARNING_DISTANCES } from '../services/preferences';
import type { RoadGuardPreferences } from '../services/preferences';

type Props = {
  preferences: RoadGuardPreferences;
  locationReady: boolean;
  locationMessage: string;
  apiMessage: string;
  onChange: (preferences: RoadGuardPreferences) => void;
  onEnableLocation: () => void;
  backgroundMonitoring: boolean;
  backgroundMessage: string;
  onToggleBackground: (enabled: boolean) => Promise<void>;
  onOpenSettings: () => void;
  onSaveApi: (baseUrl: string) => Promise<void>;
  onDone: () => void;
};

export function SettingsScreen({
  preferences,
  locationReady,
  locationMessage,
  apiMessage,
  onChange,
  onEnableLocation,
  backgroundMonitoring,
  backgroundMessage,
  onToggleBackground,
  onOpenSettings,
  onSaveApi,
  onDone,
}: Props) {
  const [apiUrl, setApiUrl] = useState(preferences.apiBaseUrl);
  const [saving, setSaving] = useState(false);
  useEffect(() => setApiUrl(preferences.apiBaseUrl), [preferences.apiBaseUrl]);

  async function saveApi() {
    setSaving(true);
    try {
      await onSaveApi(apiUrl);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>PREFERENCES</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.label}>Warning distance</Text>
      <View style={styles.row}>
        {WARNING_DISTANCES.map((distance) => (
          <Pressable
            key={distance}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferences.warningDistanceMeters === distance }}
            onPress={() => onChange({ ...preferences, warningDistanceMeters: distance })}
            style={[styles.distance, preferences.warningDistanceMeters === distance && styles.selected]}>
            <Text style={[styles.distanceText, preferences.warningDistanceMeters === distance && styles.selectedText]}>{distance} m</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.cardTitle}>Voice alerts</Text>
            <Text style={styles.body}>Speak when a configured warning area is entered.</Text>
          </View>
          <Switch
            accessibilityLabel="Voice alerts"
            value={preferences.voiceEnabled}
            onValueChange={(voiceEnabled) => onChange({ ...preferences, voiceEnabled })}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Location</Text>
        <Text style={styles.body}>{locationReady ? 'GPS is active while RoadGuard is open.' : (locationMessage || 'Location is off. Demo mode remains available.')}</Text>
        <Pressable accessibilityRole="button" onPress={onEnableLocation} style={styles.secondary}>
          <Text style={styles.secondaryText}>{locationReady ? 'Refresh location permission' : 'Enable GPS for this session'}</Text>
        </Pressable>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.cardTitle}>Background alerts</Text>
            <Text style={styles.body}>Keep a visible Android location notification while checking configured zones.</Text>
          </View>
          <Switch
            accessibilityLabel="Background location alerts"
            value={backgroundMonitoring}
            onValueChange={(enabled) => { onToggleBackground(enabled).catch(() => undefined); }}
          />
        </View>
        {backgroundMessage ? <Text accessibilityLiveRegion="polite" style={styles.note}>{backgroundMessage}</Text> : null}
        {backgroundMessage.toLowerCase().includes('allow all the time') ? (
          <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.secondary}>
            <Text style={styles.secondaryText}>Open Android app settings</Text>
          </Pressable>
        ) : null}
        <Text style={styles.note}>Android may require separate “Allow all the time” location and notification permissions. Background behavior has not yet been verified on a physical device.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Optional RoadGuard API</Text>
        <Text style={styles.body}>Leave blank for demo/offline mode. Use an HTTPS URL for a remote server. No account credentials belong here.</Text>
        <TextInput
          accessibilityLabel="API base URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://api.example.com"
          placeholderTextColor="#657a8d"
          value={apiUrl}
          onChangeText={setApiUrl}
          style={styles.input}
        />
        {apiMessage ? <Text accessibilityLiveRegion="polite" style={styles.note}>{apiMessage}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={saveApi} style={styles.secondary}>
          <Text style={styles.secondaryText}>{saving ? 'Checking…' : 'Save and check connection'}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.primary}>
        <Text style={styles.primaryText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 112 },
  kicker: { color: '#6fe0b1', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#f4f8fb', fontSize: 27, fontWeight: '800', marginTop: 7, marginBottom: 18 },
  label: { color: '#eef5f8', fontWeight: '800', marginBottom: 9 },
  row: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  distance: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#203242', backgroundColor: '#0d1823', alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: '#54d7a1', backgroundColor: '#10241d' },
  distanceText: { color: '#a5b6c5', fontWeight: '700' },
  selectedText: { color: '#eafff5' },
  card: { backgroundColor: '#0d1823', padding: 15, borderRadius: 14, marginBottom: 11 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchCopy: { flex: 1, paddingRight: 12 },
  cardTitle: { color: '#eef5f8', fontSize: 15, fontWeight: '800' },
  body: { color: '#8da0b2', lineHeight: 19, marginTop: 5 },
  note: { color: '#f1c982', lineHeight: 18, fontSize: 12, marginTop: 9 },
  secondary: { minHeight: 46, borderRadius: 11, marginTop: 12, borderWidth: 1, borderColor: '#315044', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: '#8ce3b7', fontWeight: '800', textAlign: 'center' },
  input: { marginTop: 12, borderWidth: 1, borderColor: '#26394a', color: '#f4f8fb', borderRadius: 10, paddingHorizontal: 12, minHeight: 48 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: '#54d7a1', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#071019', fontWeight: '900', fontSize: 15 },
});
