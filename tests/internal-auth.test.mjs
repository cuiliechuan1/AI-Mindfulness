import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const password = (await readFile(resolve(projectRoot, '.internal-test-secrets/password.txt'), 'utf8')).trim();
const privateKey = (await readFile(resolve(projectRoot, '.internal-test-secrets/signing-private-key.pkcs8.b64'), 'utf8')).trim();
const auth = await import('../edge-functions/api/internal-auth.js');
const {middleware} = await import('../middleware.js');

function authContext(body, clientIp = '203.0.113.10') {
  return {
    clientIp,
    env: {
      INTERNAL_TEST_PASSWORD: password,
      INTERNAL_TEST_SIGNING_PRIVATE_KEY: privateKey,
    },
    request: new Request('https://preview.example.test/api/internal-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://preview.example.test',
      },
      body: JSON.stringify(body),
    }),
  };
}

function middlewareContext(url, cookie = '') {
  const request = new Request(url, {headers: cookie ? {Cookie: cookie} : {}});
  return {
    request,
    next() {
      return new Response('NEXT', {headers: {'x-test-next': 'true'}});
    },
    redirect(location, status = 307) {
      return new Response(null, {status, headers: {Location: location}});
    },
  };
}

test('valid password creates a signed, secure, short-lived session accepted by middleware', async () => {
  const response = await auth.onRequestPost(authContext({password}));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {ok: true, expiresIn: 28800});
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, /^mied_internal_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);

  const cookie = setCookie.split(';', 1)[0];
  const guarded = await middleware(middlewareContext('https://preview.example.test/', cookie));
  assert.equal(guarded.status, 200);
  assert.equal(guarded.headers.get('x-test-next'), 'true');

  const [name, token] = cookie.split('=');
  const [claims, signature] = token.split('.');
  const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
  const tampered = `${name}=${claims}.${tamperedSignature}`;
  const rejected = await middleware(middlewareContext('https://preview.example.test/', tampered));
  assert.equal(rejected.status, 302);
});

test('unauthenticated requests preserve EdgeOne preview parameters during login redirect', async () => {
  const response = await middleware(middlewareContext(
    'https://preview.example.test/community?eo_token=preview-token&eo_time=12345&tab=public',
  ));
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.pathname, '/internal-login.html');
  assert.equal(location.searchParams.get('eo_token'), 'preview-token');
  assert.equal(location.searchParams.get('eo_time'), '12345');
  assert.equal(location.searchParams.get('return'), '/community?eo_token=preview-token&eo_time=12345&tab=public');
});

test('authentication rejects cross-origin requests and limits repeated failures', async () => {
  const crossOrigin = authContext({password});
  crossOrigin.request = new Request('https://preview.example.test/api/internal-auth', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: 'https://attacker.example'},
    body: JSON.stringify({password}),
  });
  assert.equal((await auth.onRequestPost(crossOrigin)).status, 403);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    assert.equal((await auth.onRequestPost(authContext({password: 'wrong'}, '203.0.113.90'))).status, 401);
  }
  const locked = await auth.onRequestPost(authContext({password: 'wrong'}, '203.0.113.90'));
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get('Retry-After')) > 0);
  assert.equal((await auth.onRequestPost(authContext({password}, '203.0.113.90'))).status, 429);
});

test('logout clears the session and GET is not accepted', async () => {
  const logout = await auth.onRequestPost(authContext({action: 'logout'}));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /^mied_internal_session=;/);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(auth.onRequestGet().status, 405);
});
