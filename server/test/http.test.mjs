import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function reservePort() {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('API health and public endpoints fail safely without Neon configuration', async (t) => {
  const port = await reservePort();
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: serverDirectory,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      HOST: '127.0.0.1',
      PORT: String(port),
      ADMIN_TOKEN: 'test-only-token',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  t.after(() => child.kill());

  const baseUrl = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      response = await fetch(`${baseUrl}/health`);
      break;
    } catch {
      if (child.exitCode !== null) throw new Error('API process exited before listening.');
      await delay(100);
    }
  }
  assert.ok(response, 'API should start for health checks without a database');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'degraded', databaseConfigured: false, databaseConnected: false, demoModeAvailable: true,
  });

  const publicResponse = await fetch(`${baseUrl}/v1/public`);
  assert.equal(publicResponse.status, 503);
  assert.equal((await publicResponse.json()).error.code, 'database_unavailable');
  const adminResponse = await fetch(`${baseUrl}/admin/v1/laws`);
  assert.equal(adminResponse.status, 401);
});
