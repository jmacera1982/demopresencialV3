/**
 * Auth demo unificado (totem + totem-salud + app-cliente + app-inversion-bdb + QR + app-mobileSalud + hub index).
 * La contraseña del portal se valida en cliente para UX y en servidor para cookie de proxy /api/*.
 */
(function (global) {
  var STORAGE_KEY = 'numiaPortalDemoAuth';
  /** Duración máxima de la sesión en esta pestaña (ms). */
  var SESSION_MAX_MS = 12 * 60 * 60 * 1000;

  /** Cambiá este valor para la demo en vivo (debe coincidir con DEMO_PORTAL_PASSWORD en server/.env). */
  var DEMO_PASSWORD = 'numia2026';

  function readState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.t !== 'number') return null;
      if (Date.now() - o.t > SESSION_MAX_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return o;
    } catch (e) {
      return null;
    }
  }

  function isAuthenticated() {
    return !!readState();
  }

  async function establishServerSession(password) {
    var response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password })
    });

    return response.ok;
  }

  async function login(password) {
    var p = typeof password === 'string' ? password : '';
    if (p !== DEMO_PASSWORD) {
      return false;
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ t: Date.now() }));

    try {
      var ok = await establishServerSession(p);
      if (!ok) {
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }
    } catch (e) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }

    return true;
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin'
    }).catch(function () {});
  }

  /**
   * Evita redirecciones abiertas: solo URLs del mismo origen.
   */
  function safeNextUrl(next) {
    if (!next || typeof next !== 'string') return 'index.html';
    try {
      var u = new URL(next, global.location.href);
      if (u.origin !== global.location.origin) return 'index.html';
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return 'index.html';
    }
  }

  function require() {
    if (!isAuthenticated()) {
      var next = encodeURIComponent(
        global.location.pathname + global.location.search + global.location.hash
      );
      global.location.replace('login.html?next=' + next);
    }
  }

  global.AuthPortal = {
    STORAGE_KEY: STORAGE_KEY,
    SESSION_MAX_MS: SESSION_MAX_MS,
    isAuthenticated: isAuthenticated,
    login: login,
    logout: logout,
    safeNextUrl: safeNextUrl,
    require: require
  };
})(typeof window !== 'undefined' ? window : globalThis);
