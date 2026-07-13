'use strict';

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { createSecurity } = require('./lib/security');
const { createJourneyFlows } = require('./lib/journey-flows');
const { assertStartupConfig } = require('./lib/validate-config');
require('dotenv').config({ path: path.join(__dirname, '.env') });

assertStartupConfig(process.env);

const PORT = Number(process.env.PORT) || 3000;
const JOURNEY_API_KEY = process.env.JOURNEY_API_KEY || '';
const JOURNEY_API_HOST = (process.env.JOURNEY_API_HOST || 'https://api.journeybuilder.numia.co').replace(/\/$/, '');
const JOURNEY_EMBED_HOST = (process.env.JOURNEY_EMBED_HOST || 'https://journeybuilder.numia.co').replace(/\/$/, '');
const FILA_VIRTUAL_API_TOKEN = process.env.FILA_VIRTUAL_API_TOKEN || '';
const FILA_VIRTUAL_TURN_API_TOKEN = process.env.FILA_VIRTUAL_TURN_API_TOKEN || FILA_VIRTUAL_API_TOKEN;
const FILA_VIRTUAL_BASE_URL = (process.env.FILA_VIRTUAL_BASE_URL || 'https://filavirtual2.debmedia.com/api/v1').replace(/\/$/, '');
const CITAS_API_TOKEN = process.env.CITAS_API_TOKEN || '';
const CITAS_API_TOKEN_BANK = process.env.CITAS_API_TOKEN_BANK || CITAS_API_TOKEN;
const CITAS_API_TOKEN_ANDREANI = process.env.CITAS_API_TOKEN_ANDREANI || CITAS_API_TOKEN;
const CITAS_API_TOKEN_SANMARTIN = process.env.CITAS_API_TOKEN_SANMARTIN || CITAS_API_TOKEN;
const CITAS_API_TOKEN_FARMA = process.env.CITAS_API_TOKEN_FARMA || CITAS_API_TOKEN;
const CITAS_API_TOKEN_FARMA_LIST = process.env.CITAS_API_TOKEN_FARMA_LIST || CITAS_API_TOKEN_FARMA;
const CITAS_API_TOKEN_CARE = process.env.CITAS_API_TOKEN_CARE || CITAS_API_TOKEN;
const CITAS_API_BASE_URL = (process.env.CITAS_API_BASE_URL || 'https://citas2.debmedia.com/api/v2').replace(/\/$/, '');
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || '';
const NOCODB_API_BASE_URL = (process.env.NOCODB_API_BASE_URL || 'https://app.nocodb.com/api/v2').replace(/\/$/, '');
const DEBSIGN_API_KEY = process.env.DEBSIGN_API_KEY || '';
const DEBSIGN_API_BASE_URL = (process.env.DEBSIGN_API_BASE_URL || 'https://debq2.debmedia.com/debsign/v2/api').replace(/\/$/, '');
const DEBSIGN_CONFIG_BASE_URL = (process.env.DEBSIGN_CONFIG_BASE_URL || 'https://debq2.debmedia.com/debsign/assets/debPlayerWeb/views/config.html').replace(/\/$/, '');
const MONITOR_API_KEY = process.env.MONITOR_API_KEY || '';
const MONITOR_API_BASE_URL = (process.env.MONITOR_API_BASE_URL || 'https://debq2.debmedia.com/api/monitor').replace(/\/$/, '');
const DEMO_API_TOKEN = (process.env.DEMO_API_TOKEN || '').trim();
const DEMO_PORTAL_PASSWORD = (process.env.DEMO_PORTAL_PASSWORD || '').trim();
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim();
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_HTTPONLY = process.env.COOKIE_HTTPONLY !== 'false';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'strict').trim().toLowerCase();
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true' || COOKIE_SECURE;
const DEMO_USERS_FILE = process.env.DEMO_USERS_FILE || path.join(__dirname, 'data', 'demo-users.json');

const journeyFlows = createJourneyFlows({
  flowAppCliente: process.env.JOURNEY_FLOW_APP_CLIENTE || '',
  flowTotemBanking: process.env.JOURNEY_FLOW_TOTEM_BANKING || '',
  flowSalud: process.env.JOURNEY_FLOW_SALUD || '',
  flowBbva: process.env.JOURNEY_FLOW_BBVA || '',
  flowColsanitas: process.env.JOURNEY_FLOW_COLSANITAS || '',
  embedChatId: process.env.JOURNEY_EMBED_CHAT_ID || ''
});

const security = createSecurity({
  demoApiToken: DEMO_API_TOKEN,
  demoPortalPassword: DEMO_PORTAL_PASSWORD,
  sessionSecret: SESSION_SECRET,
  cookieSecure: COOKIE_SECURE,
  cookieHttpOnly: COOKIE_HTTPONLY,
  cookieSameSite: COOKIE_SAMESITE,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: process.env.RATE_LIMIT_MAX,
  authRateLimitWindowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  authRateLimitMax: process.env.AUTH_RATE_LIMIT_MAX,
  journeyRateLimitWindowMs: process.env.JOURNEY_RATE_LIMIT_WINDOW_MS,
  journeyRateLimitMax: process.env.JOURNEY_RATE_LIMIT_MAX
});

const requireProxyAuth = security.requireProxyAuth;

function collectOrigins() {
  const origins = new Set(["'self'"]);
  const candidates = [
    JOURNEY_API_HOST,
    JOURNEY_EMBED_HOST,
    FILA_VIRTUAL_BASE_URL,
    CITAS_API_BASE_URL,
    NOCODB_API_BASE_URL,
    DEBSIGN_API_BASE_URL,
    MONITOR_API_BASE_URL,
    'https://cdn.jsdelivr.net',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];

  candidates.forEach(function (value) {
    try {
      origins.add(new URL(value).origin);
    } catch (_error) {
      /* omitir URLs inválidas */
    }
  });

  return Array.from(origins);
}

const app = express();
app.disable('x-powered-by');

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

if (FORCE_HTTPS) {
  app.use(function (req, res, next) {
    if (req.secure || req.get('x-forwarded-proto') === 'https') {
      next();
      return;
    }

    res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  });
}

app.use(
  helmet({
    hsts: FORCE_HTTPS
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: collectOrigins(),
        frameSrc: ["'self'", JOURNEY_EMBED_HOST, 'https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(security.sessionMiddleware);

let demoUsersCache = null;

function loadDemoUsers() {
  if (demoUsersCache) {
    return demoUsersCache;
  }

  try {
    const raw = fs.readFileSync(DEMO_USERS_FILE, 'utf8');
    demoUsersCache = JSON.parse(raw);
    return demoUsersCache;
  } catch (error) {
    console.error('[demo-users] No se pudo cargar', DEMO_USERS_FILE, error.message);
    demoUsersCache = { banking: {}, salud: {} };
    return demoUsersCache;
  }
}

function resolveBankingUser(alias) {
  const users = loadDemoUsers().banking || {};
  const key = alias || 'Jorge';
  return users[key] || users.Jorge || users.demo || null;
}

function resolveSaludUser(alias) {
  const users = loadDemoUsers().salud || {};
  const key = alias || 'Maria';
  return users[key] || users.Maria || users.demo || null;
}

function maskIdentifier(value) {
  if (!value || typeof value !== 'string') {
    return '••••••••';
  }

  if (value.length <= 4) {
    return '••••';
  }

  return '••••' + value.slice(-4);
}

function getFilaVirtualToken(profile) {
  if (profile === 'turn' && FILA_VIRTUAL_TURN_API_TOKEN) {
    return FILA_VIRTUAL_TURN_API_TOKEN;
  }

  return FILA_VIRTUAL_API_TOKEN;
}

function isAllowedFvPath(relativePath) {
  const allowedPrefixes = ['queue/', 'turn/', 'app/'];
  return allowedPrefixes.some(function (prefix) {
    return relativePath.indexOf(prefix) === 0;
  });
}

function isAllowedCitasPath(relativePath) {
  return (
    relativePath.indexOf('schedules') === 0 ||
    relativePath.indexOf('appointments') === 0 ||
    relativePath.indexOf('reducedSchedules') === 0 ||
    relativePath.indexOf('services/') === 0
  );
}

function getCitasToken(profile) {
  const map = {
    bank: CITAS_API_TOKEN_BANK,
    andreani: CITAS_API_TOKEN_ANDREANI,
    sanmartin: CITAS_API_TOKEN_SANMARTIN,
    farma: CITAS_API_TOKEN_FARMA,
    'farma-list': CITAS_API_TOKEN_FARMA_LIST,
    care: CITAS_API_TOKEN_CARE,
    default: CITAS_API_TOKEN
  };

  return map[profile] || map.default;
}

function getUpstreamQueryString(req) {
  const url = new URL(req.originalUrl, 'http://localhost');
  url.searchParams.delete('profile');
  return url.search || '';
}

function isAllowedNocoPath(relativePath) {
  return relativePath.indexOf('tables/') === 0;
}

function isAllowedDebsignPath(relativePath) {
  return relativePath.indexOf('stasks') === 0 || relativePath.indexOf('tasks') === 0;
}

function isAllowedMonitorPath(relativePath) {
  return relativePath.indexOf('branches') === 0;
}

async function proxyDebmediaRequest(baseUrl, token, relativePath, req, res) {
  if (!token) {
    res.status(503).json({ error: 'Token de API no configurado en el servidor' });
    return;
  }

  const queryString = getUpstreamQueryString(req);
  const url = baseUrl + '/' + relativePath + queryString;
  const method = req.method || 'GET';
  const headers = {
    'x-api-token': token
  };

  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = req.get('Content-Type') || 'application/json';
    headers['Content-Type'] = contentType;
    body = contentType.indexOf('application/json') >= 0 ? JSON.stringify(req.body || {}) : req.body;
  } else {
    headers['Content-Type'] = req.get('Content-Type') || 'text/plain';
  }

  try {
    const upstream = await fetch(url, {
      method: method,
      headers: headers,
      body: body
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      res.status(upstream.status).send(text);
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[proxy]', relativePath, error);
    res.status(502).json({ error: 'Error al contactar API upstream' });
  }
}

async function proxyCustomAuthRequest(baseUrl, authHeader, token, relativePath, req, res) {
  if (!token) {
    res.status(503).json({ error: 'Credencial de API no configurada en el servidor' });
    return;
  }

  const queryString = getUpstreamQueryString(req);
  const url = baseUrl + '/' + relativePath + queryString;
  const method = req.method || 'GET';
  const headers = {};
  headers[authHeader] = token;

  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = req.get('Content-Type') || 'application/json';
    headers['Content-Type'] = contentType;
    body = contentType.indexOf('application/json') >= 0 ? JSON.stringify(req.body || {}) : req.body;
  } else if (authHeader === 'xc-token') {
    headers['Content-Type'] = req.get('Content-Type') || 'application/json';
  } else {
    headers['Content-Type'] = req.get('Content-Type') || 'text/plain';
  }

  try {
    const upstream = await fetch(url, {
      method: method,
      headers: headers,
      body: body
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      res.status(upstream.status).send(text);
      return;
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[proxy-custom]', relativePath, error);
    res.status(502).json({ error: 'Error al contactar API upstream' });
  }
}

app.get('/api/health', function (_req, res) {
  res.json({
    ok: true,
    authConfigured: security.isAuthConfigured(),
    journeyConfigured: Boolean(JOURNEY_API_KEY),
    filaVirtualConfigured: Boolean(FILA_VIRTUAL_API_TOKEN),
    rateLimits: security.rateLimitPolicy
  });
});

app.post('/api/auth/session', security.authRateLimit, function (req, res) {
  if (!DEMO_PORTAL_PASSWORD) {
    res.status(503).json({ error: 'DEMO_PORTAL_PASSWORD no configurada en el servidor' });
    return;
  }

  const password = req.body && req.body.password;
  if (!security.validatePortalPassword(password)) {
    res.status(401).json({ error: 'Credenciales inválidas' });
    return;
  }

  security.establishPortalSession(req);
  res.json({ ok: true });
});

app.delete('/api/auth/session', security.authRateLimit, function (req, res) {
  security.destroyPortalSession(req, function (error) {
    if (error) {
      console.error('[auth/session] destroy', error);
      res.status(500).json({ error: 'No se pudo cerrar sesión' });
      return;
    }

    res.json({ ok: true });
  });
});

app.post('/api/journey/run', security.journeyRateLimit, requireProxyAuth, async function (req, res) {
  if (!JOURNEY_API_KEY) {
    res.status(503).json({ error: 'JOURNEY_API_KEY no configurada en el servidor' });
    return;
  }

  const flowKey = req.body && req.body.flowKey;
  const stream = Boolean(req.body && req.body.stream);
  const payload = (req.body && req.body.payload) || req.body || {};

  if (!journeyFlows.isValidFlowKey(flowKey)) {
    res.status(400).json({ error: 'flowKey inválido' });
    return;
  }

  const flowId = journeyFlows.resolveFlowId(flowKey);
  if (!flowId || !security.isUuid(flowId)) {
    res.status(503).json({ error: 'Flujo no configurado en el servidor para flowKey: ' + flowKey });
    return;
  }

  const url = JOURNEY_API_HOST + '/api/v1/run/' + encodeURIComponent(flowId) + '?stream=' + (stream ? 'true' : 'false');

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': JOURNEY_API_KEY,
        Origin: 'journeybuilder.numia.co'
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      data = { raw: text };
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[journey/run]', error);
    res.status(502).json({ error: 'Error al contactar Journey Builder' });
  }
});

// Rate limit general para el resto de rutas /api/* (ver rateLimitPolicy en /api/health)
app.use('/api', security.apiRateLimit);

app.get('/api/journey/chat-config', requireProxyAuth, function (req, res) {
  if (!JOURNEY_API_KEY) {
    res.status(503).json({ error: 'JOURNEY_API_KEY no configurada en el servidor' });
    return;
  }

  const flowKey = req.query.flowKey;
  if (!journeyFlows.isValidFlowKey(flowKey)) {
    res.status(400).json({ error: 'flowKey inválido' });
    return;
  }

  const flowId = journeyFlows.resolveFlowId(flowKey);
  if (!flowId || !security.isUuid(flowId)) {
    res.status(503).json({ error: 'Flujo no configurado en el servidor' });
    return;
  }

  res.json({
    host_url: JOURNEY_API_HOST,
    flow_id: flowId,
    api_key: JOURNEY_API_KEY
  });
});

app.get('/api/journey/embed-url', requireProxyAuth, function (req, res) {
  if (!JOURNEY_API_KEY) {
    res.status(503).json({ error: 'JOURNEY_API_KEY no configurada en el servidor' });
    return;
  }

  const chatKey = req.query.chatKey || 'DEFAULT';
  const chatId = journeyFlows.resolveEmbedChatId(chatKey);
  if (!chatId || !security.isUuid(chatId)) {
    res.status(400).json({ error: 'chatKey inválido o no configurado' });
    return;
  }

  res.json({
    url: JOURNEY_EMBED_HOST + '/embebbed-chat/' + encodeURIComponent(chatId) + '/' + JOURNEY_API_KEY
  });
});

app.get('/api/demo/users', requireProxyAuth, function (req, res) {
  const domain = req.query.domain === 'salud' ? 'salud' : 'banking';
  const users = loadDemoUsers()[domain] || {};
  const list = Object.keys(users).map(function (alias) {
    return { alias: alias, label: alias };
  });

  res.json({ domain: domain, users: list });
});

app.post('/api/demo/resolve', requireProxyAuth, function (req, res) {
  const domain = req.body && req.body.domain === 'salud' ? 'salud' : 'banking';
  const alias = (req.body && req.body.alias) || '';

  if (domain === 'salud') {
    const user = resolveSaludUser(alias);
    if (!user) {
      res.status(404).json({ error: 'Usuario demo no encontrado' });
      return;
    }

    res.json({
      alias: alias || 'Maria',
      apellido: user.apellido,
      displayName: (alias || 'Maria') + ' ' + user.apellido,
      telMasked: maskIdentifier(user.tel)
    });
    return;
  }

  const user = resolveBankingUser(alias);
  if (!user) {
    res.status(404).json({ error: 'Usuario demo no encontrado' });
    return;
  }

  res.json({
    alias: alias || 'Jorge',
    apellido: user.apellido,
    displayName: (alias || 'Jorge') + ' ' + user.apellido,
    dniMasked: maskIdentifier(user.dni)
  });
});

app.post('/api/demo/enqueue-body', requireProxyAuth, function (req, res) {
  const alias = (req.body && req.body.alias) || 'Jorge';
  const extraFields = (req.body && req.body.extraFields) || [];
  const user = resolveBankingUser(alias);

  if (!user) {
    res.status(404).json({ error: 'Usuario demo no encontrado' });
    return;
  }

  res.json({
    firstName: alias,
    lastName: user.apellido,
    dni: user.dni,
    email: user.email || 'mail@mail.com',
    extraFields: extraFields,
    dniMasked: maskIdentifier(user.dni)
  });
});

app.post('/api/demo/salud-contact', requireProxyAuth, function (req, res) {
  const alias = (req.body && req.body.alias) || 'Maria';
  const user = resolveSaludUser(alias);

  if (!user) {
    res.status(404).json({ error: 'Usuario demo no encontrado' });
    return;
  }

  res.json({
    alias: alias,
    tel: user.tel,
    apellido: user.apellido,
    displayName: alias + ' ' + user.apellido
  });
});

app.get('/api/demo/portal-personas', requireProxyAuth, function (_req, res) {
  const portal = loadDemoUsers().portal || [];
  const list = portal.map(function (persona) {
    return {
      id: persona.id,
      label: persona.firstName + ' ' + persona.lastName
    };
  });

  res.json({ personas: list });
});

app.post('/api/demo/portal-enqueue', requireProxyAuth, async function (req, res) {
  if (!FILA_VIRTUAL_API_TOKEN) {
    res.status(503).json({ error: 'FILA_VIRTUAL_API_TOKEN no configurada en el servidor' });
    return;
  }

  const personaId = req.body && req.body.personaId;
  const queueId = req.body && req.body.queueId;
  const branchId = req.body && req.body.branchId;
  const portal = loadDemoUsers().portal || [];
  const persona = portal.find(function (item) {
    return item.id === personaId;
  }) || portal[0];

  if (!persona || !queueId || !branchId) {
    res.status(400).json({ error: 'personaId, queueId y branchId son obligatorios' });
    return;
  }

  const payload = {
    firstName: persona.firstName,
    lastName: persona.lastName,
    dni: persona.dni,
    email: persona.email || 'demo@example.com',
    phone: persona.phone || '12345678'
  };

  const url = FILA_VIRTUAL_BASE_URL + '/queue/' + encodeURIComponent(queueId) + '/branch/' + encodeURIComponent(branchId) + '/enqueue';

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': FILA_VIRTUAL_API_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      data = { raw: text };
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json({
      data: data,
      personaLabel: persona.firstName + ' ' + persona.lastName,
      dniMasked: maskIdentifier(String(persona.dni || ''))
    });
  } catch (error) {
    console.error('[portal-enqueue]', error);
    res.status(502).json({ error: 'Error al contactar Fila Virtual' });
  }
});

app.post('/api/demo/fv-enqueue-alias', requireProxyAuth, async function (req, res) {
  if (!FILA_VIRTUAL_API_TOKEN) {
    res.status(503).json({ error: 'FILA_VIRTUAL_API_TOKEN no configurada en el servidor' });
    return;
  }

  const alias = (req.body && req.body.alias) || 'Jorge';
  const queueId = req.body && req.body.queueId;
  const branchId = req.body && req.body.branchId;
  const mode = (req.body && req.body.mode) || 'full';

  if (!queueId || !branchId) {
    res.status(400).json({ error: 'queueId y branchId son obligatorios' });
    return;
  }

  let payload;
  if (mode === 'dni-only') {
    const user = resolveBankingUser(alias);
    if (!user) {
      res.status(404).json({ error: 'Usuario demo no encontrado' });
      return;
    }
    payload = { dni: user.dni };
  } else {
    const body = await (function () {
      const user = resolveBankingUser(alias);
      if (!user) {
        return null;
      }
      return {
        firstName: alias,
        lastName: user.apellido,
        dni: user.dni,
        email: user.email || 'mail@mail.com',
        phone: user.phone || '12345678'
      };
    })();

    if (!body) {
      res.status(404).json({ error: 'Usuario demo no encontrado' });
      return;
    }
    payload = body;
  }

  const url = FILA_VIRTUAL_BASE_URL + '/queue/' + encodeURIComponent(queueId) + '/branch/' + encodeURIComponent(branchId) + '/enqueue';

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': FILA_VIRTUAL_API_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      data = { raw: text };
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[fv-enqueue-alias]', error);
    res.status(502).json({ error: 'Error al contactar Fila Virtual' });
  }
});

app.get('/api/fila-virtual/turn/code/:turnCode', requireProxyAuth, function (req, res) {
  if (!security.isTurnCode(req.params.turnCode)) {
    res.status(400).json({ error: 'Código de turno inválido' });
    return;
  }

  const profile = req.query.profile === 'turn' ? 'turn' : 'default';
  proxyDebmediaRequest(
    FILA_VIRTUAL_BASE_URL,
    getFilaVirtualToken(profile),
    'turn/code/' + encodeURIComponent(req.params.turnCode),
    req,
    res
  );
});

app.all('/api/fila-virtual/raw/*', requireProxyAuth, function (req, res) {
  const relativePath = security.extractRawProxyPath(req, '/api/fila-virtual/raw/');
  if (!relativePath) {
    res.status(400).json({ error: 'Path inválido' });
    return;
  }

  if (!isAllowedFvPath(relativePath)) {
    res.status(403).json({ error: 'Ruta de Fila Virtual no permitida' });
    return;
  }

  const profile = req.query.profile === 'turn' ? 'turn' : 'default';
  proxyDebmediaRequest(FILA_VIRTUAL_BASE_URL, getFilaVirtualToken(profile), relativePath, req, res);
});

app.all('/api/citas/raw/*', requireProxyAuth, function (req, res) {
  const relativePath = security.extractRawProxyPath(req, '/api/citas/raw/');
  if (!relativePath) {
    res.status(400).json({ error: 'Path inválido' });
    return;
  }

  if (!isAllowedCitasPath(relativePath)) {
    res.status(403).json({ error: 'Ruta de Citas no permitida' });
    return;
  }

  const profile = req.query.profile || 'default';
  proxyDebmediaRequest(CITAS_API_BASE_URL, getCitasToken(profile), relativePath, req, res);
});

app.all('/api/nocodb/raw/*', requireProxyAuth, function (req, res) {
  const relativePath = security.extractRawProxyPath(req, '/api/nocodb/raw/');
  if (!relativePath) {
    res.status(400).json({ error: 'Path inválido' });
    return;
  }

  if (!isAllowedNocoPath(relativePath)) {
    res.status(403).json({ error: 'Ruta de NocoDB no permitida' });
    return;
  }

  proxyCustomAuthRequest(NOCODB_API_BASE_URL, 'xc-token', NOCODB_API_TOKEN, relativePath, req, res);
});

app.all('/api/debsign/raw/*', requireProxyAuth, function (req, res) {
  const relativePath = security.extractRawProxyPath(req, '/api/debsign/raw/');
  if (!relativePath) {
    res.status(400).json({ error: 'Path inválido' });
    return;
  }

  if (!isAllowedDebsignPath(relativePath)) {
    res.status(403).json({ error: 'Ruta de Debsign no permitida' });
    return;
  }

  proxyCustomAuthRequest(DEBSIGN_API_BASE_URL, 'x-api-key', DEBSIGN_API_KEY, relativePath, req, res);
});

app.get('/api/debsign/config', requireProxyAuth, function (_req, res) {
  if (!DEBSIGN_API_KEY) {
    res.status(503).json({ error: 'DEBSIGN_API_KEY no configurada en el servidor' });
    return;
  }

  res.redirect(DEBSIGN_CONFIG_BASE_URL + '?token=' + encodeURIComponent(DEBSIGN_API_KEY));
});

app.all('/api/monitor/raw/*', requireProxyAuth, function (req, res) {
  const relativePath = security.extractRawProxyPath(req, '/api/monitor/raw/');
  if (!relativePath) {
    res.status(400).json({ error: 'Path inválido' });
    return;
  }

  if (!isAllowedMonitorPath(relativePath)) {
    res.status(403).json({ error: 'Ruta de Monitor no permitida' });
    return;
  }

  proxyCustomAuthRequest(MONITOR_API_BASE_URL, 'x-api-key', MONITOR_API_KEY, relativePath, req, res);
});

app.post('/api/fila-virtual/enqueue', requireProxyAuth, async function (req, res) {
  if (!FILA_VIRTUAL_API_TOKEN) {
    res.status(503).json({ error: 'FILA_VIRTUAL_API_TOKEN no configurada en el servidor' });
    return;
  }

  const queueId = req.body && req.body.queueId;
  const branchId = req.body && req.body.branchId;
  const payload = (req.body && req.body.payload) || {};

  if (!queueId || !branchId) {
    res.status(400).json({ error: 'queueId y branchId son obligatorios' });
    return;
  }

  const url = FILA_VIRTUAL_BASE_URL + '/queue/' + encodeURIComponent(queueId) + '/branch/' + encodeURIComponent(branchId) + '/enqueue';

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': FILA_VIRTUAL_API_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (_parseError) {
      data = { raw: text };
    }

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('[fila-virtual/enqueue]', error);
    res.status(502).json({ error: 'Error al contactar Fila Virtual' });
  }
});

const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));

app.get('*', function (req, res, next) {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  const filePath = path.join(staticRoot, req.path);
  if (req.path.endsWith('.html') || !path.extname(req.path)) {
    const htmlPath = req.path.endsWith('.html') ? filePath : path.join(staticRoot, req.path + '.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
      return;
    }
  }

  next();
});

app.listen(PORT, function () {
  console.log('Demopresencial proxy en http://localhost:' + PORT);
  if (!JOURNEY_API_KEY) {
    console.warn('ADVERTENCIA: JOURNEY_API_KEY no definida — copie server/.env.example a server/.env');
  }
});
