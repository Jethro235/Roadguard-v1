import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import RoadGuardApp from './src/RoadGuardApp';

function renderAppError(error: Error, retry: () => void) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>RoadGuard could not start</Text>
      <Text style={styles.errorMessage}>
        {error.message || 'An unexpected rendering error occurred.'}
      </Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppErrorBoundary fallback={renderAppError}>
        <RoadGuardApp />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#071019',
  },
  errorTitle: {
    color: '#f4f8fb',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  errorMessage: {
    color: '#ffb5b5',
    fontSize: 14,
    lineHeight: 21,
  },
  retry: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: 12,
  },
  retryText: {
    color: '#6fe0b1',
    fontWeight: '800',
  },
});
