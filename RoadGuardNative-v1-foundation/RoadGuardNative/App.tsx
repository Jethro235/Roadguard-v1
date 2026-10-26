import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import RoadGuardApp from './src/RoadGuardApp';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#071019' }}>
      <StatusBar barStyle="light-content" backgroundColor="#071019" />
      <RoadGuardApp />
    </SafeAreaView>
  );
}
