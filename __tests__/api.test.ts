import { normalizeApiBaseUrl } from '../src/services/api';

test('API URL accepts secure remote and local development origins', () => {
  expect(normalizeApiBaseUrl('https://roadguard.example/api/')).toBe('https://roadguard.example/api');
  expect(normalizeApiBaseUrl('http://10.0.2.2:3000')).toBe('http://10.0.2.2:3000');
  expect(normalizeApiBaseUrl('')).toBe('');
});

test('API URL rejects insecure remote hosts and embedded credentials or query tokens', () => {
  expect(() => normalizeApiBaseUrl('http://roadguard.example')).toThrow(/Use HTTPS/);
  expect(() => normalizeApiBaseUrl('https://user:secret@roadguard.example')).toThrow(/cannot contain embedded credentials/);
  expect(() => normalizeApiBaseUrl('https://roadguard.example?token=secret')).toThrow(/cannot contain embedded credentials/);
});
