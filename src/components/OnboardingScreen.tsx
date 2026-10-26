import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Vehicle } from '../types';

const choices: Array<{ id: Vehicle; label: string }> = [
  { id: 'car', label: 'Car' },
  { id: 'motorcycle', label: 'Motorcycle' },
  { id: 'bus', label: 'Bus / minibus' },
];

type Props = {
  vehicle: Vehicle;
  onVehicleChange: (vehicle: Vehicle) => void;
  onContinue: () => void;
};

export function OnboardingScreen({ vehicle, onVehicleChange, onContinue }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>WELCOME TO ROADGUARD</Text>
      <Text style={styles.title}>A little more confidence on every trip.</Text>
      <Text style={styles.body}>
        Choose your vehicle to personalize road references and temporary community reports.
        Location stays on your device unless you deliberately submit a report.
      </Text>
      <Text style={styles.label}>What do you drive?</Text>
      {choices.map((choice) => (
        <Pressable
          key={choice.id}
          testID={`onboarding-vehicle-${choice.id}`}
          accessibilityRole="radio"
          accessibilityState={{ checked: vehicle === choice.id }}
          onPress={() => onVehicleChange(choice.id)}
          style={[styles.choice, vehicle === choice.id && styles.choiceSelected]}>
          <Text style={styles.choiceText}>{choice.label}</Text>
          <Text style={styles.check}>{vehicle === choice.id ? 'Selected' : ''}</Text>
        </Pressable>
      ))}
      <Text style={styles.privacy}>
        You can use demo mode without location access. Enable GPS later when you want nearby alerts or to report a checkpoint.
      </Text>
      <Pressable testID="onboarding-continue" accessibilityRole="button" onPress={onContinue} style={styles.primary}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#071019' },
  eyebrow: { color: '#6fe0b1', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#f4f8fb', fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 12 },
  body: { color: '#9db0c1', fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 28 },
  label: { color: '#f4f8fb', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  choice: { minHeight: 56, paddingHorizontal: 16, marginBottom: 9, borderWidth: 1, borderColor: '#203242', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0d1823' },
  choiceSelected: { borderColor: '#54d7a1', backgroundColor: '#10241d' },
  choiceText: { color: '#f0f5f8', fontSize: 16, fontWeight: '700' },
  check: { color: '#6fe0b1', fontSize: 12, fontWeight: '800' },
  privacy: { color: '#8195a8', fontSize: 12, lineHeight: 18, marginTop: 12 },
  primary: { minHeight: 52, borderRadius: 14, marginTop: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#54d7a1' },
  primaryText: { color: '#071019', fontSize: 16, fontWeight: '900' },
});
