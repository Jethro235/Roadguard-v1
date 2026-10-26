/* global jest */

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    watchPosition: jest.fn((success) => {
      success({
        coords: {
          latitude: 6.4654,
          longitude: 3.6016,
        },
      });
      return 1;
    }),
    getCurrentPosition: jest.fn((success) => {
      success({
        coords: {
          latitude: 6.4654,
          longitude: 3.6016,
        },
      });
    }),
    clearWatch: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(null),
    clear: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    setDefaultLanguage: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn(),
  },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = ({ children, ...props }) =>
    React.createElement(View, props, children);

  MockMapView.Marker = ({ children, ...props }) =>
    React.createElement(View, props, children);
  MockMapView.Circle = ({ children, ...props }) =>
    React.createElement(View, props, children);

  return {
    __esModule: true,
    default: MockMapView,
    PROVIDER_GOOGLE: 'google',
    Marker: MockMapView.Marker,
    Circle: MockMapView.Circle,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
