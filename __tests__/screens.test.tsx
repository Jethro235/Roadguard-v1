import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { OnboardingScreen } from '../src/components/OnboardingScreen';
import { SettingsScreen } from '../src/components/SettingsScreen';
import { DEFAULT_PREFERENCES } from '../src/services/preferences';

test('onboarding offers every vehicle and completes on request', async () => {
  const onVehicleChange = jest.fn();
  const onContinue = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <OnboardingScreen vehicle="car" onVehicleChange={onVehicleChange} onContinue={onContinue} />,
    );
  });
  const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
  expect(texts).toContain('WELCOME TO ROADGUARD');
  expect(texts).toContain('Motorcycle');
  expect(texts).toContain('Bus / minibus');
  const motorcycle = renderer.root.findByProps({ testID: 'onboarding-vehicle-motorcycle' });
  await ReactTestRenderer.act(() => motorcycle.props.onPress());
  expect(onVehicleChange).toHaveBeenCalledWith('motorcycle');
  const continueButton = renderer.root.findByProps({ testID: 'onboarding-continue' });
  await ReactTestRenderer.act(() => continueButton.props.onPress());
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test('settings expose warning distance, voice, location, API, and background controls', async () => {
  const onChange = jest.fn();
  const onSaveApi = jest.fn().mockResolvedValue(undefined);
  const onToggleBackground = jest.fn().mockResolvedValue(undefined);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <SettingsScreen
        preferences={{ ...DEFAULT_PREFERENCES, onboardingComplete: true }}
        locationReady={false}
        locationMessage="Location is off."
        apiMessage="Demo/offline mode."
        backgroundMonitoring={false}
        backgroundMessage="Background monitoring is off."
        onChange={onChange}
        onEnableLocation={jest.fn()}
        onToggleBackground={onToggleBackground}
        onOpenSettings={jest.fn()}
        onSaveApi={onSaveApi}
        onDone={jest.fn()}
      />,
    );
  });
  const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
  expect(texts).toContain('Warning distance');
  expect(texts).toContain('Voice alerts');
  expect(texts).toContain('Optional RoadGuard API');
  expect(texts).toContain('Background alerts');
});
