const SESSION_COOKIE = 'mied_internal_session';
const SESSION_MAX_SECONDS = 8 * 60 * 60;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const attempts = new Map();

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...JSON_HEADERS, ...extraHeaders},
  });
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ''));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function clientKey(context) {
  const forwarded = context.request.headers.get('x-forwarded-for') || '';
  return context.clientIp || context.request.headers.get('x-real-ip') || forwarded.split(',')[0].trim() || 'unknown';
}

function checkLockout(key, now) {
  const entry = attempts.get(key);
  if (!entry) return 0;
  if (entry.lockedUntil > now) return Math.ceil((entry.lockedUntil - now) / 1000);
  if (now - entry.windowStarted >= ATTEMPT_WINDOW_MS) attempts.delete(key);
  return 0;
}

function recordFailure(key, now) {
  let entry = attempts.get(key);
  if (!entry || now - entry.windowStarted >= ATTEMPT_WINDOW_MS) {
    entry = {failures: 0, windowStarted: now, lockedUntil: 0};
  }
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + LOCKOUT_MS;
  attempts.set(key, entry);
  return entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 1000) : 0;
}

async function equalSecret(actual, expected) {
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(actualDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

async function issueSession(privateKeyBase64) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.getRandomValues(new Uint8Array(18));
  const claims = {
    v: 1,
    iat: now,
    exp: now + SESSION_MAX_SECONDS,
    nonce: encodeBase64Url(nonce),
  };
  const encodedClaims = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64(privateKeyBase64),
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    privateKey,
    new TextEncoder().encode(encodedClaims),
  );
  return `${encodedClaims}.${encodeBase64Url(new Uint8Array(signature))}`;
}

function cookieAttributes(requestUrl, maxAge) {
  const secure = requestUrl.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function onRequestPost(context) {
  const requestUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin');
  if (origin !== requestUrl.origin) return jsonResponse({error: '请求来源无效。'}, 403);

  const contentType = context.request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse({error: '请求格式无效。'}, 415);
  }
  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (contentLength > 4096) return jsonResponse({error: '请求过大。'}, 413);

  let body;
  try {
    const text = await context.request.text();
    if (text.length > 4096) return jsonResponse({error: '请求过大。'}, 413);
    body = JSON.parse(text);
  } catch {
    return jsonResponse({error: '请求格式无效。'}, 400);
  }

  if (body && body.action === 'logout') {
    return jsonResponse(
      {ok: true},
      200,
      {'Set-Cookie': `${SESSION_COOKIE}=; ${cookieAttributes(requestUrl, 0)}`},
    );
  }

  const expectedPassword = context.env && context.env.INTERNAL_TEST_PASSWORD;
  const privateKey = context.env && context.env.INTERNAL_TEST_SIGNING_PRIVATE_KEY;
  if (!expectedPassword || !privateKey) {
    return jsonResponse({error: '内测验证服务尚未完成配置。'}, 503);
  }

  const key = clientKey(context);
  const now = Date.now();
  const retryAfter = checkLockout(key, now);
  if (retryAfter) {
    return jsonResponse(
      {error: '失败次数过多，请稍后再试。'},
      429,
      {'Retry-After': String(retryAfter)},
    );
  }

  const suppliedPassword = typeof body.password === 'string' ? body.password : '';
  if (!(await equalSecret(suppliedPassword, expectedPassword))) {
    const lockedFor = recordFailure(key, now);
    if (lockedFor) {
      return jsonResponse(
        {error: '失败次数过多，请稍后再试。'},
        429,
        {'Retry-After': String(lockedFor)},
      );
    }
    return jsonResponse({error: '访问密码不正确。'}, 401);
  }

  attempts.delete(key);
  try {
    const token = await issueSession(privateKey);
    return jsonResponse(
      {ok: true, expiresIn: SESSION_MAX_SECONDS},
      200,
      {'Set-Cookie': `${SESSION_COOKIE}=${token}; ${cookieAttributes(requestUrl, SESSION_MAX_SECONDS)}`},
    );
  } catch {
    return jsonResponse({error: '内测验证服务配置无效。'}, 503);
  }
}

export function onRequestGet() {
  return jsonResponse({error: 'Method Not Allowed'}, 405, {Allow: 'POST'});
}
