const VEHICLES = new Set(['car', 'motorcycle', 'bus']);
const REVIEW_STATES = new Set(['draft', 'pending-review', 'published']);

export function validateReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { latitude, longitude, vehicle } = body;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!VEHICLES.has(vehicle)) return null;
  return { latitude, longitude, vehicle };
}

function validSourceUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return false;
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isFinite(date.getTime()) && (value.length !== 10 || date.toISOString().slice(0, 10) === value);
}

export function validateLaw(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected a law object.' };
  const fields = ['id', 'title', 'summary', 'fineText', 'sourceName', 'sourceUrl', 'effectiveDate', 'reviewStatus'];
  if (fields.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return { error: 'All law fields are required.' };
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(body.id)) return { error: 'Law id must use lowercase letters, numbers, and hyphens.' };
  if (!REVIEW_STATES.has(body.reviewStatus)) return { error: 'Invalid review status.' };
  if (!validSourceUrl(body.sourceUrl)) return { error: 'Source URL must use HTTPS.' };
  if (!validIsoDate(body.effectiveDate) || body.effectiveDate.length !== 10) return { error: 'Effective date must use a valid YYYY-MM-DD date.' };
  if (!Array.isArray(body.vehicleTypes) || !body.vehicleTypes.length || !body.vehicleTypes.every((v) => VEHICLES.has(v))) return { error: 'Choose one or more supported vehicle types.' };
  if (body.reviewStatus === 'published' && (!body.reviewedBy || !validIsoDate(body.reviewedAt))) return { error: 'Published laws require reviewer and a valid review date.' };
  return { value: {
    id: body.id.trim(), title: body.title.trim(), summary: body.summary.trim(), fineText: body.fineText.trim(),
    actionText: typeof body.actionText === 'string' ? body.actionText.trim() : '',
    vehicleTypes: [...new Set(body.vehicleTypes)],
    sourceName: body.sourceName.trim(), sourceUrl: body.sourceUrl.trim(), effectiveDate: body.effectiveDate,
    reviewStatus: body.reviewStatus, reviewedBy: body.reviewedBy?.trim() || null, reviewedAt: body.reviewedAt || null,
  } };
}

export function validateZone(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected a zone object.' };
  const required = ['id', 'name', 'provenance', 'sourceUrl', 'publicationStatus', 'verifiedBy', 'verifiedAt'];
  if (required.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return { error: 'Zone identity, provenance, source, publication status, and verification fields are required.' };
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(body.id)) return { error: 'Zone id must use lowercase letters, numbers, and hyphens.' };
  if (!validSourceUrl(body.sourceUrl)) return { error: 'Source URL must use HTTPS.' };
  if (!['draft', 'pending-review', 'published'].includes(body.publicationStatus)) return { error: 'Invalid publication status.' };
  const { latitude, longitude, warningRadiusMeters } = body;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: 'Latitude is invalid.' };
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: 'Longitude is invalid.' };
  if (!Number.isInteger(warningRadiusMeters) || warningRadiusMeters < 50 || warningRadiusMeters > 5000) return { error: 'Warning radius must be 50–5000 metres.' };
  if (!Array.isArray(body.vehicleTypes) || !body.vehicleTypes.length || !body.vehicleTypes.every((v) => VEHICLES.has(v))) return { error: 'Choose one or more supported vehicle types.' };
  if (body.publicationStatus === 'published' && !body.verifiedBy.trim()) return { error: 'Published zones require a verifier.' };
  if (!validIsoDate(body.verifiedAt)) return { error: 'Verification date must be valid ISO date or timestamp.' };
  return { value: {
    id: body.id.trim(), name: body.name.trim(), provenance: body.provenance.trim(), sourceUrl: body.sourceUrl.trim(),
    publicationStatus: body.publicationStatus, latitude, longitude, warningRadiusMeters,
    vehicleTypes: [...new Set(body.vehicleTypes)], verifiedBy: body.verifiedBy.trim(), verifiedAt: body.verifiedAt,
  } };
}

export function createRateLimiter({ limit = 30, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();
  return (key) => {
    const current = now();
    const bucket = buckets.get(key);
    if (!bucket || current >= bucket.resetAt) {
      if (!bucket && buckets.size >= 10_000) {
        for (const [savedKey, savedBucket] of buckets) {
          if (savedBucket.resetAt <= current) buckets.delete(savedKey);
        }
        if (buckets.size >= 10_000) buckets.delete(buckets.keys().next().value);
      }
      buckets.set(key, { count: 1, resetAt: current + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    if (bucket.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - current) / 1000) };
    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count };
  };
}
