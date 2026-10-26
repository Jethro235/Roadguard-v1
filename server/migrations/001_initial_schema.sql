BEGIN;

CREATE TABLE IF NOT EXISTS laws (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  fine_text TEXT NOT NULL,
  action_text TEXT NOT NULL DEFAULT '',
  vehicle_types TEXT[] NOT NULL CHECK (cardinality(vehicle_types) > 0),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  effective_date DATE NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('draft', 'pending-review', 'published')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS law_versions (
  id BIGSERIAL PRIMARY KEY,
  law_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id, version)
);

CREATE TABLE IF NOT EXISTS official_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  warning_radius_meters INTEGER NOT NULL CHECK (warning_radius_meters BETWEEN 50 AND 5000),
  vehicle_types TEXT[] NOT NULL CHECK (cardinality(vehicle_types) > 0),
  provenance TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  publication_status TEXT NOT NULL CHECK (publication_status IN ('draft', 'pending-review', 'published')),
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'motorcycle', 'bus')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  CHECK (expires_at <= reported_at + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS community_reports_expiry_idx ON community_reports (expires_at);
CREATE INDEX IF NOT EXISTS community_reports_recent_idx ON community_reports (reported_at DESC);

COMMIT;
