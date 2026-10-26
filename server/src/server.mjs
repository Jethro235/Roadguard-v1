import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRateLimiter, validateLaw, validateReport, validateZone } from './validation.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const configuredAdminToken = process.env.ADMIN_TOKEN?.trim() || '';
const adminToken = configuredAdminToken.length >= 32 ? configuredAdminToken : '';
const reportLimiter = createRateLimiter({ limit: 8, windowMs: 2 * 60 * 60 * 1000 });
const publicLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
const adminLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const adminPage = await readFile(new URL('../admin.html', import.meta.url));
let pool;
let dbStartupError = '';

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = await import('pg');
    const databaseUrl = new URL(process.env.DATABASE_URL);
    if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
      throw new Error('DATABASE_URL must use PostgreSQL.');
    }
    // Preserve certificate validation even if a provider URI carries sslmode or
    // certificate query options; node-postgres otherwise replaces the ssl object.
    for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) databaseUrl.searchParams.delete(option);
    pool = new Pool({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true }, max: 5, idleTimeoutMillis: 30_000 });
    await pool.query('SELECT 1');
  } catch (error) {
    dbStartupError = error instanceof Error ? error.name : 'DatabaseUnavailable';
    console.error(`[RoadGuard API] Database unavailable (${dbStartupError}); API will report degraded status.`);
    await pool?.end().catch(() => {});
    pool = undefined;
  }
}

function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, body) {
  secureHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendProblem(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function clientKey(req) {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim().slice(0, 80);
  }
  return req.socket.remoteAddress || 'unknown';
}

function applyRateLimit(req, res, limiter, bucketPrefix) {
  const result = limiter(`${bucketPrefix}:${clientKey(req)}`);
  res.setHeader('RateLimit-Limit', bucketPrefix === 'reports' ? '8' : bucketPrefix === 'admin' ? '30' : '120');
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  if (result.allowed) return true;
  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  sendProblem(res, 429, 'rate_limited', 'Too many requests. Try again later.');
  return false;
}

async function readJson(req) {
  const maxBytes = 16 * 1024;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 });
  }
}

async function requireDatabase(res) {
  if (!pool) {
    sendProblem(res, 503, 'database_unavailable', 'RoadGuard data service is unavailable. Demo/offline mode remains available in the mobile app.');
    return false;
  }
  return true;
}

function isAuthorized(req) {
  if (!adminToken) return false;
  const header = req.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const supplied = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(adminToken);
  return supplied.length === expected.length && cryptoTimingSafeEqual(supplied, expected);
}

import { timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';

async function upsertLaw(value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM laws WHERE id = $1 FOR UPDATE', [value.id]);
    const version = existing.rowCount ? Number(existing.rows[0].version) + 1 : 1;
    if (existing.rowCount) {
      await client.query('INSERT INTO law_versions (law_id, version, snapshot) VALUES ($1, $2, $3::jsonb) ON CONFLICT (law_id, version) DO NOTHING', [value.id, existing.rows[0].version, JSON.stringify(existing.rows[0])]);
    }
    const { rows } = await client.query(
      `INSERT INTO laws (id,title,summary,fine_text,action_text,vehicle_types,source_name,source_url,effective_date,review_status,reviewed_by,reviewed_at,version,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,fine_text=EXCLUDED.fine_text,action_text=EXCLUDED.action_text,vehicle_types=EXCLUDED.vehicle_types,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,effective_date=EXCLUDED.effective_date,review_status=EXCLUDED.review_status,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,version=EXCLUDED.version,updated_at=now()
       RETURNING id,title,summary,fine_text AS fine,action_text AS action,vehicle_types AS vehicle,source_name AS source,source_url AS "sourceUrl",effective_date::text AS "effectiveDate",review_status AS "reviewStatus",reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",version`,
      [value.id,value.title,value.summary,value.fineText,value.actionText,value.vehicleTypes,value.sourceName,value.sourceUrl,value.effectiveDate,value.reviewStatus,value.reviewedBy,value.reviewedAt,version],
    );
    await client.query('INSERT INTO law_versions (law_id, version, snapshot) VALUES ($1, $2, $3::jsonb)', [value.id, version, JSON.stringify(rows[0])]);
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function upsertZone(value) {
  const { rows } = await pool.query(
    `INSERT INTO official_zones (id,name,latitude,longitude,warning_radius_meters,vehicle_types,provenance,source_url,publication_status,verified_by,verified_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,warning_radius_meters=EXCLUDED.warning_radius_meters,vehicle_types=EXCLUDED.vehicle_types,provenance=EXCLUDED.provenance,source_url=EXCLUDED.source_url,publication_status=EXCLUDED.publication_status,verified_by=EXCLUDED.verified_by,verified_at=EXCLUDED.verified_at,updated_at=now()
     RETURNING id,name,latitude,longitude,warning_radius_meters AS "warningRadiusMeters",vehicle_types AS "vehicleTypes",provenance,source_url AS "sourceUrl",publication_status AS "publicationStatus",verified_by AS "verifiedBy",verified_at AS "verifiedAt"`,
    [value.id,value.name,value.latitude,value.longitude,value.warningRadiusMeters,value.vehicleTypes,value.provenance,value.sourceUrl,value.publicationStatus,value.verifiedBy,value.verifiedAt],
  );
  return rows[0];
}

const server = createServer(async (req, res) => {
  try {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';

  if (url.pathname === '/health' && method === 'GET') {
    let connected = false;
    if (pool) {
      try { await pool.query('SELECT 1'); connected = true; } catch { connected = false; }
    }
    return sendJson(res, connected ? 200 : 503, {
      status: connected ? 'ok' : 'degraded',
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      databaseConnected: connected,
      demoModeAvailable: true,
    });
  }

  if (url.pathname === '/admin' && method === 'GET') {
    secureHeaders(res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.writeHead(200);
    return res.end(adminPage);
  }

  if (url.pathname.startsWith('/admin/v1/')) {
    if (!applyRateLimit(req, res, adminLimiter, 'admin')) return;
    if (!isAuthorized(req)) return sendProblem(res, 401, 'unauthorized', 'Provide a valid admin token.');
    if (!await requireDatabase(res)) return;
    if (url.pathname === '/admin/v1/laws' && method === 'GET') {
      const { rows } = await pool.query('SELECT id,title,summary,fine_text AS "fineText",action_text AS "actionText",vehicle_types AS "vehicleTypes",source_name AS "sourceName",source_url AS "sourceUrl",effective_date::text AS "effectiveDate",review_status AS "reviewStatus",reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",version FROM laws ORDER BY id');
      return sendJson(res, 200, { laws: rows });
    }
    if (url.pathname === '/admin/v1/zones' && method === 'GET') {
      const { rows } = await pool.query('SELECT id,name,latitude,longitude,warning_radius_meters AS "warningRadiusMeters",vehicle_types AS "vehicleTypes",provenance,source_url AS "sourceUrl",publication_status AS "publicationStatus",verified_by AS "verifiedBy",verified_at AS "verifiedAt" FROM official_zones ORDER BY id');
      return sendJson(res, 200, { zones: rows });
    }
    const versionsMatch = url.pathname.match(/^\/admin\/v1\/laws\/([a-z0-9][a-z0-9-]{1,79})\/versions$/);
    if (versionsMatch && method === 'GET') {
      const { rows } = await pool.query('SELECT version,snapshot,recorded_at AS "recordedAt" FROM law_versions WHERE law_id=$1 ORDER BY version DESC', [versionsMatch[1]]);
      return sendJson(res, 200, { versions: rows });
    }
    if (url.pathname === '/admin/v1/laws' && method === 'PUT') {
      const parsed = validateLaw(await readJson(req));
      if (parsed.error) return sendProblem(res, 400, 'invalid_law', parsed.error);
      const law = await upsertLaw(parsed.value);
      return sendJson(res, 200, { law });
    }
    if (url.pathname === '/admin/v1/zones' && method === 'PUT') {
      const parsed = validateZone(await readJson(req));
      if (parsed.error) return sendProblem(res, 400, 'invalid_zone', parsed.error);
      const zone = await upsertZone(parsed.value);
      return sendJson(res, 200, { zone });
    }
    return sendProblem(res, 404, 'not_found', 'Admin endpoint not found.');
  }

  if (url.pathname.startsWith('/v1/')) {
    if (!applyRateLimit(req, res, publicLimiter, 'public')) return;
    if (!await requireDatabase(res)) return;
    if (url.pathname === '/v1/public' && method === 'GET') {
      const [lawResult, zoneResult] = await Promise.all([
        pool.query(`SELECT id,title,summary,fine_text AS fine,action_text AS action,vehicle_types AS vehicle,source_name AS source,source_url AS "sourceUrl",effective_date::text AS "effectiveDate",review_status AS "reviewStatus",reviewed_at AS "reviewedAt",version FROM laws WHERE review_status='published' ORDER BY title`),
        pool.query(`SELECT id,name,latitude,longitude,warning_radius_meters,vehicle_types,provenance,source_url FROM official_zones WHERE publication_status='published' ORDER BY name`),
      ]);
      return sendJson(res, 200, { laws: lawResult.rows, zones: zoneResult.rows });
    }
    if (url.pathname === '/v1/reports' && method === 'GET') {
      await pool.query('DELETE FROM community_reports WHERE expires_at <= now()');
      const { rows } = await pool.query(`SELECT id,latitude,longitude,vehicle_type,reported_at,expires_at FROM community_reports WHERE expires_at > now() ORDER BY reported_at DESC LIMIT 200`);
      return sendJson(res, 200, { reports: rows.map(reportDto) });
    }
    if (url.pathname === '/v1/reports' && method === 'POST') {
      if (!applyRateLimit(req, res, reportLimiter, 'reports')) return;
      const report = validateReport(await readJson(req));
      if (!report) return sendProblem(res, 400, 'invalid_report', 'Provide a valid latitude, longitude, and vehicle type.');
      const { rows } = await pool.query(`INSERT INTO community_reports (latitude,longitude,vehicle_type) VALUES ($1,$2,$3) RETURNING id,latitude,longitude,vehicle_type,reported_at,expires_at`, [report.latitude,report.longitude,report.vehicle]);
      return sendJson(res, 201, reportDto(rows[0]));
    }
  }
  return sendProblem(res, 404, 'not_found', 'Endpoint not found.');
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (status === 500) console.error(`[RoadGuard API] Request failed (${error instanceof Error ? error.name : 'UnknownError'}).`);
    return sendProblem(res, status, status === 500 ? 'internal_error' : 'invalid_request', status === 500 ? 'The request could not be completed.' : error.message);
  }
});

function reportDto(row) {
  return {
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    reportedAt: new Date(row.reported_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    confirmations: 1,
    vehicle: [row.vehicle_type],
  };
}

const expiryTimer = setInterval(() => {
  if (pool) pool.query('DELETE FROM community_reports WHERE expires_at <= now()').catch(() => {});
}, 30 * 60 * 1000);
expiryTimer.unref();

server.listen(port, host, () => {
  console.log(`[RoadGuard API] Listening on ${host}:${port}; database ${pool ? 'connected' : 'unavailable'}; admin ${adminToken ? 'configured' : 'disabled'}.`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(expiryTimer);
    server.close(() => { void pool?.end().finally(() => process.exit(0)); });
  });
}

server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
server.on('error', (error) => {
  console.error(`[RoadGuard API] Server error: ${error.name}`);
  process.exitCode = 1;
});

if (dbStartupError) {
  // Keep startup usable for health/status reporting without exposing connection details.
}
