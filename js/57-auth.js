/* Copilot Feature-dle · Microsoft sign-in (no libraries).
   The standard OpenID Connect "authorization code with PKCE" flow for a single-page app:
     1. signIn() sends the browser to Microsoft with a one-time state, nonce and PKCE challenge (the matching secret stays in this tab's sessionStorage).
     2. Microsoft sends the browser back to this page with a short-lived code in the URL fragment.
     3. takeCallback() reads it and wipes it from the address bar; complete() trades it for an ID token, checks it, and signs the player in.
   Only the ID token's claims are used (who the player is). No token is ever stored, and nothing here calls another Microsoft service.
   This file has no screens: the buttons, dialogs and account card are in 98-view-account.js. */
(function () {
  'use strict';
  const FD = (window.FD = window.FD || {});

  const SCOPE = 'openid profile';
  const PENDING_MS = 15 * 60 * 1000; /* a sign-in that takes longer than this is abandoned */
  const SKEW_S = 300; /* clocks on phones drift: allow five minutes either way when checking token times */
  const cfg = () => FD.config.auth || {};

  /* ---------- tiny encoders ---------- */
  const b64u = (bytes) => btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64u = (s) => { const p = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(p + '==='.slice((p.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
  const randomB64u = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
  const sha256 = (text) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  /* PKCE: the challenge is the URL-safe base64 of the SHA-256 of the verifier (RFC 7636) */
  const challengeFor = async (verifier) => b64u(await sha256(verifier));
  const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

  function decodeJwt(token) {
    const parts = String(token || '').split('.');
    if (parts.length < 2 || !parts[1]) return null;
    try { const o = JSON.parse(new TextDecoder().decode(fromB64u(parts[1]))); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
  }

  /* ---------- what this copy of the game is set up for ---------- */
  const configured = () => /\S/.test(String(cfg().clientId || ''));
  const storageOk = () => { try { const k = '__fd_auth_probe'; sessionStorage.setItem(k, '1'); sessionStorage.removeItem(k); return true; } catch (e) { return false; } };
  /* sign-in needs a web address (not a file), a secure page (https or localhost: the browser's crypto needs it) and somewhere to keep the one-time secret */
  let secureNow;
  const secure = () => (secureNow !== undefined ? secureNow : (secureNow = /^https?:$/.test(location.protocol) && window.isSecureContext === true && !!(window.crypto && crypto.subtle) && storageOk()));
  const available = () => configured() && secure();
  const why = () => (!/^https?:$/.test(location.protocol) ? 'file' : !configured() ? 'unconfigured' : !secure() ? 'insecure' : '');

  const tenant = () => String(cfg().tenant || 'organizations').trim().replace(/[^A-Za-z0-9.\-_]/g, '') || 'organizations';
  const authority = () => String(cfg().authority || '').trim().replace(/\/+$/, '') || 'https://login.microsoftonline.com/' + tenant();
  /* the address Microsoft sends people back to: this page, without any ?query, #route or trailing index.html */
  const redirectUri = () => String(cfg().redirectUri || '').trim() || location.origin + location.pathname.replace(/index\.html$/i, '');
  const issuerFor = (auth, tid) => new URL(auth).origin + '/' + tid + '/v2.0';

  /* "Alex R." (friendly on a big screen) or the whole name, kept within 24 characters */
  function friendlyName(full, style) {
    let n = String(full || '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim();
    if (!n) return 'Player';
    if (n.includes(',')) { const [last, first] = n.split(',').map((s) => s.trim()); if (first) n = first + ' ' + last; } /* "Rivera, Alex" is Alex Rivera */
    n = n.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, '').trim() || n; /* "(Contractor)" and " - Engage Squared" are not part of a name */
    const cut = (s) => { if (s.length <= 24) return s; const t = s.slice(0, 24), sp = t.lastIndexOf(' '); return sp >= 8 ? t.slice(0, sp) : t; };
    if (style === 'full') return cut(n);
    const parts = n.split(' ').filter(Boolean);
    if (parts.length === 1) return cut(parts[0]);
    return cut(parts[0] + ' ' + Array.from(parts[parts.length - 1])[0].toUpperCase() + '.');
  }
  const firstName = (full) => friendlyName(full, 'full').split(' ')[0] || 'there';

  /* ---------- the one-time secret kept between leaving and coming back (this tab only) ---------- */
  const pendingKey = () => 'fd.auth.pending:' + (FD.store ? FD.store.key : '');
  const readPending = () => { try { const o = JSON.parse(sessionStorage.getItem(pendingKey()) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
  const clearPending = () => { try { sessionStorage.removeItem(pendingKey()); } catch (e) { /* ignore */ } };
  /* only one of this game's own screens may be returned to */
  const safeReturn = (v) => (/^#\/[A-Za-z0-9\/_\-.%]{0,100}(\?[A-Za-z0-9_=&\-.%]{0,100})?$/.test(String(v || '')) ? String(v) : '#/');

  /* the sign-in address and what has to be remembered to finish the job */
  async function buildAuthUrl() {
    const verifier = randomB64u(48), state = randomB64u(16), nonce = randomB64u(16);
    const pending = { state, nonce, verifier, clientId: String(cfg().clientId).trim(), authority: authority(), redirectUri: redirectUri(), tenant: tenant(), returnTo: safeReturn(location.hash), t: Date.now() };
    const q = new URLSearchParams({
      client_id: pending.clientId, response_type: 'code', redirect_uri: pending.redirectUri, response_mode: 'fragment', scope: SCOPE,
      state, nonce, code_challenge: await challengeFor(verifier), code_challenge_method: 'S256', prompt: 'select_account'
    });
    return { url: pending.authority + '/oauth2/v2.0/authorize?' + q.toString(), pending };
  }

  /* checks an ID token's claims. ctx = { clientId, nonce, authority, tenant }.  Returns { ok, reason } or { ok, tid, oid, name, email }.
     The token came straight from Microsoft's token endpoint over TLS, so (as OpenID Connect allows) its claims are checked rather than its signature. */
  function validateClaims(c, ctx, now = Date.now() / 1000) {
    const no = (reason) => ({ ok: false, reason });
    if (!c || typeof c !== 'object') return no('no token');
    if (c.aud !== ctx.clientId) return no('it was meant for a different app');
    if (typeof c.tid !== 'string' || !/^[0-9a-f-]{32,36}$/i.test(c.tid)) return no('no tenant');
    if (c.iss !== issuerFor(ctx.authority, c.tid)) return no('it came from an unexpected issuer');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ctx.tenant || '') && c.tid.toLowerCase() !== ctx.tenant.toLowerCase()) return no('it came from a different organisation');
    if (!Number.isFinite(c.exp) || c.exp < now - SKEW_S) return no('it has expired');
    if (c.nbf != null && (!Number.isFinite(c.nbf) || c.nbf > now + SKEW_S)) return no('it isn\u2019t valid yet');
    if (typeof c.nonce !== 'string' || !same(c.nonce, ctx.nonce)) return no('the nonce didn\u2019t match');
    const oid = typeof c.oid === 'string' && c.oid ? c.oid : typeof c.sub === 'string' ? c.sub : '';
    if (!oid || oid.length > 80) return no('no account id');
    return { ok: true, tid: c.tid.toLowerCase(), oid, name: String(c.name || c.preferred_username || '').slice(0, 120), email: String(c.preferred_username || c.email || '').slice(0, 160) };
  }

  const auth = (FD.auth = {
    SCOPE, configured, secure, available, why, authority, redirectUri, buildAuthUrl, validateClaims, decodeJwt, challengeFor, friendlyName, firstName, safeReturn, b64u,
    required: () => !!cfg().required && available(),
    /* the friendly gate: sign-in is required, it is possible, and nobody is signed in yet */
    gated: () => !!cfg().required && available() && !FD.store.account(),
    account: () => FD.store.account(),
    /* the browser is sent to Microsoft here. A test can swap this out to see where it would have gone. */
    go: (url) => location.assign(url)
  });

  /* ---------- 1. leave for Microsoft ---------- */
  auth.signIn = async function signIn() {
    if (!available()) return { ok: false, reason: why() || 'unavailable' };
    if (navigator.onLine === false) return { ok: false, reason: 'offline' };
    let built;
    try { built = await buildAuthUrl(); } catch (e) { return { ok: false, reason: 'crypto' }; }
    try { sessionStorage.setItem(pendingKey(), JSON.stringify(built.pending)); } catch (e) { return { ok: false, reason: 'storage' }; }
    FD.store.saveNow(); /* everything is saved before leaving, so an unfinished game is waiting on the way back */
    auth.go(built.url);
    return { ok: true };
  };

  /* ---------- 2. come back ---------- */
  /* Microsoft returns to this page as  #code=...&state=...  (or #error=...). Our own screens always look like #/something, so the two never mix.
     The address bar is cleaned straight away, so the code is never left in the browser's history. */
  auth.takeCallback = function takeCallback() {
    const h = location.hash.replace(/^#/, '');
    if (!/^(code|error)=/.test(h)) return null;
    const sp = new URLSearchParams(h), pending = readPending();
    history.replaceState(null, '', location.pathname + location.search + safeReturn(pending && pending.returnTo));
    return { code: sp.get('code') || '', state: sp.get('state') || '', error: sp.get('error') || '', description: sp.get('error_description') || '', pending };
  };

  const oneLine = (s) => String(s || '').split(/\r?\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 160);

  /* ---------- 3. finish ---------- */
  /* resolves { ok: true, display, created, adopted } or { ok: false, message }; it never throws */
  auth.complete = async function complete(cb) {
    const fail = (message) => ({ ok: false, message });
    try {
      const pend = cb && cb.pending;
      clearPending(); /* one go only */
      if (!pend || !Number.isFinite(pend.t) || Date.now() - pend.t > PENDING_MS) return fail('That sign-in took too long, so it was dropped. Please try again.');
      if (!cb.state || !same(cb.state, pend.state)) return fail('That sign-in wasn\u2019t the one this page started, so it was ignored.');
      if (cb.error) return fail(cb.error === 'access_denied' ? 'Sign-in was cancelled. No problem: you can carry on as a guest.' : 'Microsoft couldn\u2019t sign you in: ' + (oneLine(cb.description) || cb.error));
      if (!cb.code) return fail('Microsoft didn\u2019t send back a sign-in code. Please try again.');

      let res, body;
      try {
        res = await fetch(pend.authority + '/oauth2/v2.0/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
          body: new URLSearchParams({ client_id: pend.clientId, grant_type: 'authorization_code', code: cb.code, redirect_uri: pend.redirectUri, code_verifier: pend.verifier, scope: SCOPE }).toString()
        });
        body = await res.json().catch(() => ({}));
      } catch (e) { return fail('Couldn\u2019t reach Microsoft to finish signing in. Check your connection and try again.'); }
      if (!res.ok || !body || !body.id_token) return fail('Microsoft couldn\u2019t finish signing you in: ' + (oneLine(body && body.error_description) || 'it sent back an error') + '.');

      const v = validateClaims(decodeJwt(body.id_token), { clientId: pend.clientId, nonce: pend.nonce, authority: pend.authority, tenant: pend.tenant });
      if (!v.ok) return fail('Microsoft\u2019s reply didn\u2019t check out (' + v.reason + '), so you weren\u2019t signed in.');

      const id = 'ms_' + hex(await sha256(v.tid + ':' + v.oid)).slice(0, 24);
      const display = friendlyName(v.name || v.email, cfg().nameStyle);
      const acct = { id, name: v.name || display, display, email: v.email, tenant: v.tid };
      /* this device already holds a guest's progress and this is a brand-new account: it is the player's call whether that progress comes along */
      let adopt = false;
      const cur = FD.store.profile();
      if (!FD.store.state.profiles[id] && !cur.account && FD.store.hasProgress(cur) && FD.account && FD.account.askAdopt) adopt = (await FD.account.askAdopt(display, cur)) === 'adopt';
      const r = FD.store.signIn(acct, { adopt });
      return { ok: true, display, created: r.created, adopted: r.adopted };
    } catch (e) {
      console.error(e);
      return fail('Something went wrong while signing in. Please try again.');
    }
  };

  /* ---------- sign out ---------- */
  auth.signOut = () => FD.store.signOut();
})();
