import express from 'express';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWorkspaceDb, validateWorkspaceWrite, workspaceCookie } from './server/workspace-db.js';
import { openTotalDemo, totalDemoRouter } from './server/total-demo.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const app = express();
const databasePath = process.env.PVPT_DATABASE_PATH === ':memory:' ? ':memory:' :
  path.resolve(process.env.PVPT_DATABASE_PATH || path.join(directory, '.pvpt', 'demo.sqlite'));
const publicDirectories = ['data', 'demo', 'docs', 'public'].map(name => nearestRealPath(path.join(directory, name)));

function nearestRealPath(filename) {
  if (existsSync(filename)) return realpathSync(filename);
  return path.join(nearestRealPath(path.dirname(filename)), path.basename(filename));
}

if (databasePath !== ':memory:') {
  const resolved = nearestRealPath(databasePath);
  if (publicDirectories.some(dir => resolved === dir || resolved.startsWith(dir + path.sep))) {
    throw new Error('PVPT_DATABASE_PATH must be outside the served project directories.');
  }
}

const storage = openWorkspaceDb(databasePath, {
  fixture: path.join(directory, 'data', 'product-project-fixture.json'),
  reference: path.join(directory, 'data', 'reference-datasets.json')
});

const scenarioBankPath = nearestRealPath(path.resolve(process.env.PVPT_TOTAL_DEMO_DB ||
  path.join(directory, '.pvpt', 'total-demo.sqlite')));
if (publicDirectories.some(dir => scenarioBankPath === dir || scenarioBankPath.startsWith(dir + path.sep))) {
  throw new Error('PVPT_TOTAL_DEMO_DB must be outside the served project directories.');
}
const scenarioBank = openTotalDemo(scenarioBankPath);

app.disable('x-powered-by');
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

function readCookie(request, name) {
  const cookie = (request.get('cookie') || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(name + '='));
  return cookie?.slice(name.length + 1);
}

function sameOrigin(request) {
  if (request.get('sec-fetch-site') && !['same-origin', 'none'].includes(request.get('sec-fetch-site'))) return false;
  const origin = request.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && url.host === request.get('host');
  } catch {
    return false;
  }
}

app.get('/api/health', (_request, response) => {
  const healthy = storage.health();
  response.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unavailable', app: 'PVPT Executive Demo', mode: 'DEMO_SYNTHETIC', storage: 'sqlite' });
});

app.get('/api/catalog', (_request, response) => {
  response.json({ fixture: storage.readReference('fixture'), reference: storage.readReference('reference') });
});

app.get('/data/product-project-fixture.json', (_request, response) => {
  response.set('Cache-Control', 'no-store').json(storage.readReference('fixture'));
});

function getWorkspace(request, response, create) {
  let id = storage.workspaceId(readCookie(request, workspaceCookie));
  if (!id && create) {
    const created = storage.createWorkspace();
    id = created.id;
    response.cookie(workspaceCookie, created.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.PVPT_COOKIE_SECURE === '1' || request.secure,
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
  }
  return id;
}

app.get('/api/workspace', (request, response) => {
  response.json(storage.readWorkspace(getWorkspace(request, response, true)));
});

app.put('/api/workspace/:section', express.json({ limit: '2mb' }), (request, response) => {
  if (!sameOrigin(request)) return response.status(403).json({ error: 'cross_origin_write' });
  const id = storage.workspaceId(readCookie(request, workspaceCookie));
  if (!id) return response.status(428).json({ error: 'workspace_required' });
  const section = request.params.section;
  const invalid = validateWorkspaceWrite(section, request.body);
  if (invalid) return response.status(400).json({ error: invalid });
  const result = storage.saveWorkspace(id, section, request.body.revision, request.body.value);
  if (result.invalid) return response.status(400).json({ error: result.invalid });
  if (result.conflict) return response.status(409).json({ error: 'revision_conflict', revision: result.revision, value: result.value });
  response.json(result);
});

app.use('/api/total-demo', totalDemoRouter({ bank: scenarioBank, storage, getWorkspace, allowWrite: sameOrigin }));

app.use('/api', (_request, response) => response.status(404).json({ error: 'not_found' }));

app.use('/demo', express.static(path.join(directory, 'demo')));
app.use('/docs', express.static(path.join(directory, 'docs')));
app.use(express.static(path.join(directory, 'demo')));

app.get('/', (_request, response) => {
  response.sendFile(path.join(directory, 'demo', 'index.html'));
});

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'payload_too_large' });
  if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'invalid_json' });
  if (error.code?.includes('SQLITE')) return response.status(503).json({ error: 'database_unavailable' });
  console.error('PVPT request failed:', error.code || error.name);
  response.status(500).json({ error: 'internal_error' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`PVPT server running on http://0.0.0.0:${server.address().port}`);
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  // Let in-flight requests finish first. A browser may keep a connection
  // open across restart, so bound the time it can delay shutdown.
  const deadline = setTimeout(() => server.closeAllConnections(), 2000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    scenarioBank.close();
    storage.close();
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
