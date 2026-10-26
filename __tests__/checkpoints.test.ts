import { removeExpired } from '../src/services/checkpoints';
import type { Checkpoint } from '../src/types';

test('checkpoint expiry is exactly two-hour friendly and removes corrupt records', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const valid: Checkpoint = {
    id: 'active',
    latitude: 6.5,
    longitude: 3.5,
    reportedAt: new Date().toISOString(),
    expiresAt: future,
    confirmations: 1,
    vehicle: ['car'],
  };
  const expired = { ...valid, id: 'expired', expiresAt: new Date(Date.now() - 1).toISOString() };
  const invalidDate = { ...valid, id: 'invalid-date', expiresAt: 'not-a-date' };
  const invalidCoordinates = { ...valid, id: 'invalid-coordinates', latitude: 95 };
  expect(removeExpired([valid, expired, invalidDate, invalidCoordinates])).toEqual([valid]);
});
