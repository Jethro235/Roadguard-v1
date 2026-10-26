import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, validateLaw, validateReport, validateZone } from '../src/validation.mjs';

test('checkpoint validation accepts a user submitted point and rejects invalid coordinates', () => {
  assert.deepEqual(validateReport({ latitude: 6.5, longitude: 3.5, vehicle: 'car' }), { latitude: 6.5, longitude: 3.5, vehicle: 'car' });
  assert.equal(validateReport({ latitude: 91, longitude: 3.5, vehicle: 'car' }), null);
  assert.equal(validateReport({ latitude: 6.5, longitude: 3.5, vehicle: 'plane' }), null);
  assert.equal(validateReport({ latitude: 6.5, longitude: 3.5, vehicle: 'car', userHistory: [1, 2] }).userHistory, undefined);
});

test('legal content requires source URL and explicit review state', () => {
  const draft = validateLaw({
    id: 'speed-rule', title: 'Speed rule', summary: 'Summary', fineText: 'Unverified',
    sourceName: 'Official source', sourceUrl: 'https://example.gov.ng/traffic',
    effectiveDate: '2026-01-01', reviewStatus: 'draft', vehicleTypes: ['car'],
  });
  assert.equal(draft.error, undefined);
  assert.equal(validateLaw({ ...draft.value, sourceUrl: 'http://example.gov.ng' }).error, 'Source URL must use HTTPS.');
  assert.match(validateLaw({ ...draft.value, reviewStatus: 'published' }).error, /reviewer and a valid review date/);
});

test('official zone publication validates provenance, source, and coordinate bounds', () => {
  const valid = {
    id: 'verified-zone', name: 'Verified area', latitude: 6.5, longitude: 3.5,
    warningRadiusMeters: 500, vehicleTypes: ['car'], provenance: 'Source record 123',
    sourceUrl: 'https://agency.example.gov.ng/zone', publicationStatus: 'published',
    verifiedBy: 'Reviewer', verifiedAt: '2026-10-20T10:00:00.000Z',
  };
  assert.equal(validateZone(valid).error, undefined);
  assert.equal(validateZone({ ...valid, longitude: 181 }).error, 'Longitude is invalid.');
});

test('rate limiter enforces a scoped fixed window', () => {
  let now = 1000;
  const limit = createRateLimiter({ limit: 2, windowMs: 100, now: () => now });
  assert.equal(limit('ip').allowed, true);
  assert.equal(limit('ip').allowed, true);
  assert.equal(limit('ip').allowed, false);
  now += 101;
  assert.equal(limit('ip').allowed, true);
});
